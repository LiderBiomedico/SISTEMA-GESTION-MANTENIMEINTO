// netlify/functions/analyze.js  v5.0 — Zona + VIP + Maddox automático
exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:corsHeaders(), body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:corsHeaders(), body:JSON.stringify({error:'Método no permitido'}) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode:500, headers:corsHeaders(), body:JSON.stringify({error:'ANTHROPIC_API_KEY no configurada'}) };

  let body;
  try { body = JSON.parse(event.body||'{}'); } catch { return { statusCode:400, headers:corsHeaders(), body:JSON.stringify({error:'Body JSON inválido'}) }; }

  const { imageBase64, mimeType } = body;
  if (!imageBase64||!mimeType) return { statusCode:400, headers:corsHeaders(), body:JSON.stringify({error:'Se requiere imageBase64 y mimeType'}) };

  const validMimes=['image/jpeg','image/png','image/gif','image/webp'];
  const useMime=validMimes.includes(mimeType)?mimeType:'image/jpeg';

  const prompt=`Eres un sistema clínico de análisis vascular de VASCULAR AI + MAVI, Hospital Susana López de Valencia E.S.E.

Analiza la imagen y realiza TRES evaluaciones:

1. ZONA ANATÓMICA
Zonas válidas: "antebrazo" (venas cefálica/basílica ∅3mm), "fosa" (antecubital ∅4.5mm), "muneca" (∅2mm), "dorso" (metacarpianas ∅1.8mm), "central" (yugular/subclavia).

2. ESCALA VIP — Visual Infusion Phlebitis (Jackson, 1998)
Evalúa signos visuales en el sitio de inserción del catéter venoso:
- Grado 0: sin signos, sitio normal
- Grado 1: leve eritema y/o leve dolor cerca del sitio
- Grado 2: eritema visible + dolor + induración o edema local
- Grado 3: eritema extenso + trayecto venoso enrojecido/indurado >1cm + dolor intenso
- Grado 4: eritema + induración + trayecto >3cm + exudado purulento o necrosis

3. ESCALA MADDOX (Maddox, 1977)
Evalúa la progresión clínica de la flebitis con criterios más específicos:
- Grado 0: sin evidencia, sitio normal, sin dolor
- Grado 1: eritema leve sin dolor palpable, sin edema ni induración
- Grado 2: eritema con dolor leve-moderado al tacto, posible edema incipiente, sin induración
- Grado 3: eritema + dolor moderado + induración palpable a lo largo del trayecto venoso
- Grado 4: eritema extenso + induración marcada + trayecto >1cm + dolor intenso + posible cordón venoso
- Grado 5: eritema + trayecto >3cm + induración dura + fiebre local + posible exudado o necrosis (tromboflebitis)

REGLAS:
- Si no hay sitio de inserción visible: asigna vip_grado:null y maddox_grado:null
- Ante duda entre grados, elige el MENOR (conservador)
- Los grados VIP y Maddox deben ser concordantes entre sí
- La escala Maddox (0-5) tiene un grado más que VIP (0-4), y es más específica en estadios intermedios

Responde SOLO con JSON válido sin markdown:
{"zona":"antebrazo","confianza":85,"descripcion":"texto","hallazgos":["h1","h2","h3"],"recomendacion":"texto","vip_grado":0,"vip_confianza":90,"vip_signos":["signo1","signo2"],"vip_accion":"acción clínica VIP recomendada","maddox_grado":0,"maddox_confianza":88,"maddox_signos":["signo clínico 1","signo clínico 2"],"maddox_accion":"acción clínica Maddox recomendada"}

Tipos de campo: vip_grado entero 0-4 o null, maddox_grado entero 0-5 o null, *_confianza entero 0-100, *_signos lista de signos observados, *_accion conducta clínica indicada.`;

  try {
    const response=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model:'claude-opus-4-5',
        max_tokens:1000,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:useMime,data:imageBase64}},
          {type:'text',text:prompt}
        ]}]
      })
    });

    if(!response.ok){const e=await response.text();return{statusCode:response.status,headers:corsHeaders(),body:JSON.stringify({error:`Anthropic API error ${response.status}`,detail:e.slice(0,300)})};}

    const data=await response.json();
    const raw=data?.content?.find(c=>c.type==='text')?.text||'';

    let result=null;
    try{result=JSON.parse(raw.trim());}catch{const m=raw.match(/\{[\s\S]*?\}/);if(m){try{result=JSON.parse(m[0]);}catch{}}}

    if(!result?.zona){
      result={
        zona:'antebrazo',confianza:25,
        descripcion:'No se pudo identificar la zona.',
        hallazgos:['Imagen procesada','Zona no identificada','Seleccione manualmente'],
        recomendacion:'Seleccione la zona en el diagrama.',
        vip_grado:null,vip_confianza:0,vip_signos:[],vip_accion:'Evalúe el sitio manualmente con la escala VIP.',
        maddox_grado:null,maddox_confianza:0,maddox_signos:[],maddox_accion:'Evalúe el sitio manualmente con la escala Maddox.'
      };
    }

    // Validar rangos
    if(result.vip_grado!==null&&(result.vip_grado<0||result.vip_grado>4)) result.vip_grado=null;
    if(result.maddox_grado!==null&&(result.maddox_grado<0||result.maddox_grado>5)) result.maddox_grado=null;

    // Derivar automáticamente si falta uno
    if(result.vip_grado!==null&&(result.maddox_grado===null||result.maddox_grado===undefined)){
      const vipToMx={0:0,1:1,2:2,3:4,4:5};
      result.maddox_grado=vipToMx[result.vip_grado]??0;
      result.maddox_confianza=Math.max((result.vip_confianza||50)-10,30);
      result.maddox_signos=result.vip_signos||[];
      result.maddox_accion=result.vip_accion||'Evaluar clínicamente.';
    } else if(result.maddox_grado!==null&&(result.vip_grado===null||result.vip_grado===undefined)){
      const mxToVip={0:0,1:1,2:1,3:2,4:3,5:4};
      result.vip_grado=mxToVip[result.maddox_grado]??0;
      result.vip_confianza=Math.max((result.maddox_confianza||50)-10,30);
      result.vip_signos=result.maddox_signos||[];
      result.vip_accion=result.maddox_accion||'Evaluar clínicamente.';
    }

    return{statusCode:200,headers:corsHeaders(),body:JSON.stringify(result)};
  }catch(err){return{statusCode:500,headers:corsHeaders(),body:JSON.stringify({error:'Error interno: '+err.message})};}
};

function corsHeaders(){return{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};}
