// ============================================================================
// HSLV - Frontend app.js (browser-safe, consolidated)
// Corregido: sin conflictos de módulos, compatible con inventario-module.js
// ============================================================================

var API_BASE_URL = '/.netlify/functions';

// Token para autenticación con Netlify Functions
function getAuthHeader() {
  const token =
    localStorage.getItem('HSLV_AUTH_TOKEN') ||
    localStorage.getItem('AIRTABLE_TOKEN') ||
    'ok';
  return { Authorization: `Bearer ${token}` };
}

// ============================================================================
// NAVEGACIÓN ENTRE MÓDULOS
// ============================================================================

const HOSPITAL_LOGO_DATA_URI = 'data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCADLAMgDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAYHBAUIAwIB/8QASRAAAQMDAQUFBQYEAgUNAQAAAQIDBAAFBhEHEiExQRMUIlFhCDJxgZEVI0JSocFicrHRJDMWQ5KisiU0OERTdIKEk7TC4fDx/8QAGwEAAQUBAQAAAAAAAAAAAAAAAAECAwQFBgf/xAAwEQACAgIBAgUACgMBAQAAAAAAAQIDBBESITEFEyJBUQYjYXGBobHR4fAUMsHxkf/aAAwDAQACEQMRAD8A7LpSlAClKUAKUpQApSlAClKHlQApUZzHNLRjSOzfUZE0jVMZo+L4qP4R8aqTIs+yO8LUkSzBjnk1GO7w9Vcz+lZWb4xj4j4t7l8Ir25MK+nuX8XWwvcLiAo/h14191yqpa1Odopxal894qJP1rf2HMsisy092uLjzI/1Mg9og/XiPkazKvpNW5asg0vse/2IY5yb6o6LpULwvaFa78tESUBAnq4BtavA4f4VfsePxqaV0OPk1ZEOdb2i5CcZrcWKUpU44UpSgBSlKAFKUoAUpSgBSlKAFKUoAUpUE2m5ucfSi32wtuXJYClFQ3kso9R5noPnUGTk141bssekhk5qC2yd0qOYNlUPJ7d2rWjUtoASGCeKT5jzSfOpGafTdC6CnB7TFjJSW0KrvaXnybSV2izrSu4aaOu80senqr+lZe1TMPsCELfAcH2nJTwI/wBSj859fL61RylKUoqUoqUo6kk6knzNc9414u6fqKX6vd/H8lTJyePoj3P15xx55bzzi3HVneWtZ1Uo+ZNfNK2OP2W5X6eIdsjl1wDVaidEIHmo9K4+EJWS4xW2zNScnpGupVmN7IbgWNXL1GS7p7oZUU/XX9qh2VYvd8bfSi4spLSzo2+0dUL9PQ+hq1f4blUQ52QaRJKiyC20aSrQ2a7Qltras1/eKkHRMeWs8QeiVn+ivrVX0IBGh4im4eZbiWc6396+RK7ZVvaOqhx41+1V2yDMlP7mO3R7edSNIbqjxWB+AnzHT0q0a9Cw8uvLqVkP/DYqsVkeSFK0WZZNBxq1mTKPaPL4MMJPicV+w8zUb2aZ4q+yF227BpqeSVsKQNEuJ57o9R+opJ51FdyolL1MHbFSUG+pYNKClXCQUpSgBSlKAFKUoAUpSgDVZZeWbBYZN0eAV2SdG0fnWeCU/Wub50uROmvTZbhdffWVuKPUmrJ29XNSpdvs6FeBCDIcA6kndTr/AL1VhXDfSDLduR5SfSP6mVmWcp8fZGZZrnNs9xauFveLT7R4HoodUkdQav7CMohZNaxIY0akt6JkME8UK8/UHoa51rPx+7zbHdGrjb3N11HBST7rieqVehqt4X4pLCnqXWD7r/qGY97rfXsXnnmHQsmh7w3Y9wbT9zIA/wB1Xmn+lUPdrdMtVwdgXBhTMho6KSeRHQg9QfOuicTv8LIrQifDVofddaJ8TS+qT/frWNm2KwMngdk+A1KbB7CQkeJB8j5p9K6HxLwuvOh59H+35P8AkuX0K1codznU8ATXQWy6zs2nD4ZSgdvKQH31dVKUNR8gNBVGX+zz7HcV2+5MFt0e6R7rifzJPUVeey+8M3bD4YSsdvFQI7yeqSkaA/MaGsz6PQjDKnGxakl/6QYa1Y0+5KTWuyO1R71ZZVtkpCkPNkA/lV0UPUGtjWuyO6x7LZZVxkrCUMtkga+8rokepNdhdw8uXPtrqaUtaezmZaFNrU2v3kKKVfEcK+o7L0h9tiO0t11xQShCBqVE9AK9YcaXc56I8Vhb8qQskIQNSSTqfl61eOzzCI2OMCXL3JF0cTopwDwtA/hR+561574f4bZm2aj0iu7/AL7mPTQ7X07GNs4wRmxtouNzSh66KGqRzTHHknzV5n6VIMwyODjVqVMlnfcV4WWQfE6ryHp5npWRkt6hWC0u3GcvdbRwSke84rokeprnrJ75OyG7LuE5XE+FpoHwtJ6JH9+tdNm5dXhVCpoXqf8AdsvW2Rx4cYdzzv8Ad519ujlxuDu+6vglI91tPRKR0FYkd56NIbkx3FNPNKC21p5pUORrzpXFSslKXNvqZbk29nSGEX1GRY7HuI3Uukbj6B+Fwcx+/wADW7qm9hF0UzfJlpWr7uS12qB/Gnn+h/Srkr0XwvKeVjRsffs/vRs0WeZBMUpStAmFKUoAUpWvyO7RbFYZ15m73d4TCnnN0cSEjXQetI3oRvS2zYUrDstyhXi0xbpbn0vxJTYdacSeBB/fzFZlL3BPZQm2Jal57KB5IZaSPhu6/vUPqebcYSo+XNS9PBKjJIP8SSQf00qB15t4nFxy7E/lmLetWSFKUqgRG7wzI5eM3lE1jecYVomQzrwcR/ccxXQ9rnRblAZnQ3Q6w+gLQodR/euXan2x/KTarmLLNc0hS1/dFR4NOn9lf10rofA/EvIn5Fj9L7fY/wCS5i38XxfYtfKMft2Q24w7g1vacW3E8Ftq80mqenWjK9n91VNgqW5GPDvDaN5txPk4nof/AMDV71+EAjQjUeRrpc3w2vJamnxmuzRdtoU+q6Mp9vbBNDG65Z4indPeS+QnX4afvWmedy7aJcEJDRMZCuG6kojs+pJ5n6mrsVZ7QpZWq1wSonXeLCdf6VmNoQ2gIbQlCRyCRoBVR+F5N/pyLm4/CWtkbx5y6Tl0I7hGI27GImjI7eY4PvpKh4leg8k+lb6dKjwojsqU6lplpBW4tR4JAr2qm9s2UmbMOPQnP8NHUDKUD/mOdE/AdfX4Vbyr6fDcbcVpLsvt/vcksnGiHQjOd5PIye7l87yITRKYzJ6D8x/iP/1UepSvPbrp3Tdk3tsyJScntilKVGNJPsscU3n1sKfxKWk/AoNdCCqI2MwlSs4aeA1RFZW6o+RI3R/Wr3Fdx9HItYrb93+xqYS1WKV4XGZFt8F+dNfbYjMILjrizolCQNSTWDid9hZLj0O+W4r7rMb3298aKA1I4joeFb+1vRb5Leja0pSlFFVt7Ss1UPZHc0pOhkuMsfIuAn9Aasmqm9qwKOyvUchcWCfh4qiv6Vy+4hyHqqX3FO7EtqEjCJ32bcu0kWCQvVxCeKoyjzWgeXmn5jjz6xtc+Fc7excLdKalRX0BbTrStUqHoa4DqYbNdol/wWbvQHO829xWr8B1R7NfmUn8CvUfPWs/HyuHpl2MvFzHX6Z9jqTa1YF3vGVOx0b8uES80AOKk6eJP04/KqGB1Goq/tne0DHc4g9tapO5KQkF+E8QHmj8Oo/iHCq+2s4ibROVebe1/wAnyFaupSODLh/+J/Q8PKsjx/B8xf5VfX5/cs5VamvNh1IFSlK5MoCnwJB8xSlAHQWzK/qyDGGnX1ay4x7GR/EQOCvmND8dalNUvsJnqYyOXbyo7kmPvgfxIP8AYmror0bwjJeTixnLuuj/AANnHnzrTYpSlaROR7aDfjj2MyJreneF/dRwfzq5H5cT8q52UpS1KWtRUtRKlKJ4knmasvb3PUu5W22JV4Wm1PrHqo6D9AfrVZ1wfj+S7cp1+0f19zJy7HKzXwKUpWGVRQ8BrSprstxFV+uIuE1o/ZkZWp15PLHJI9B1+lT42PPJtVcF1Y+EHOXFE82NWBdqx5Vwko3ZM8hehHFLY90fPUn51NJ0uNBiOy5j7UeOykrcdcUEpQkcySeVR7PM3x7CbZ3q8ywhxSfuIrfF14+SU+XqdAK5Y2obTL9nUktSFdytKFatQWlapPkpw/jV+g6CvQoeXhUxqj7GjZfDGjxXVm+26bVXMxfVZLItbVhZXqpZ1SqYoclEdEDoOvM9BVteyxMVJ2WIYUrXus15oDyBIUP+I1yfXUHsjhQ2f3EnkbmvT/00VFjWSndtlPEtlZfyl8FzUpStQ2BVee0VBM/ZFed0aqjhuQPghaSf01qw6wr5b2rtZptsfA7KXHWwvh0Ukj96ZOPKLQyyPODj8nA1K97jCkWy4ybbLSUSIjymHAeikkg/0rwrBa0c0e9vmzLdOanW+U9ElMq3m3mVlK0n0Iro3ZRtlt+Rx043m4YZmPJ7JElQAYla8NFDkhR+h9OVc11+EAjQ8qkrtlX27E1N8qntHRG0TDX8ZmdvHC3bW8r7pzmWifwK/Y9aidZGyLa2IMZOK5we/WR1PZNyndVqjjolfVSPXmn4cpNneGuWQC52xzvtleAU28g73Zg8gSOafJVYPiXhiju+hen3Xx/BYlGM1zr7e6+CI0pSsIhJZsjUU5/b9OqXAfhuGr/qi9ikRUjNg+BqmLHWsnyJ0SP6mr0rufo5FrEbfu3/AMNXCX1YpSlb5bKI20LUrO3QeSYzQH0J/eoXU/26RFM5VGl6HdkRQNfVJIP6EVAK828Ui45lifyYt61ZIUpUpwTDpOROmVJUYlpa1LshXDf05hOv6nkKrUUWZE1XWttkcIOb0j4wHEpWT3DVW8zbmlffvac/4E+v9K3e1Ha5acNhnGcObjybiwnslLA3mInofzr9PPn5VD9rG1pluErENn6hEtrQLT85rgXB1S2eg818z08zSYrsMSiGDXwr6yfd/wDESTvVK4V9/d/sZV2uM+73F243SY9MmPHVx51W8o+noPQcKxaUpW9lFvYrrb2YIKoeyeI6pOnfJL0geo3t0f8ADXJjDL0l9uNHQVvPLDbaRzUpR0A+pru3D7Q3YMWtllb00hxUMkjqQBqfmdTV3BjubkaHh0NzcjbUpStQ2BSlKAOXfamxFVqyprJ4rWkO6+B8gcESEjr/ADJAPxBqm67tzTHbflWNy7HckbzEhGgUB4m1j3Vp9QeNcT5dj9yxbIZVjure5Jjq4KA8LqD7q0+YI/t0rJy6eMuS7MxM6jy58l2ZqqUpVMpCrT2KbUnMVcTj+QKMrHHzu+Mbxia8yB1QeqenMdQaspT4TcHtD67JVy5R7nUOb7Pglj7bxXSVBdT2pjtq3tEnjvNn8SfT6VXPUjqOdZHs9bTl4/Paxa+yCbPIXuxXVq/5o4TwGv5CfoePLWr2yTAbDfLk1PcaMd0OBT/Y6APjyUPM+Y41Ry/BY5H1uN0fuv2NBVRvjzr6P3RrNiVkVAx9y6Po3Xp6gUA8w0n3fqdT9KsA18tNoabS22hKEJACUpGgAHIVDtrmcxMFxdycrcduD+rcGOT/AJjmnM/wp5n6da6PGpjiURrXZI0IqNNfXsjyyPaXj9jz+24hLc0flj71/eG5HUr/AC0r9Vcfhw86nFcAXGZLuU+RcLhIXIlyXC486o8VKPM11B7Oe0Y5LaRjl4kb15gt/duLPGUyOSvVSeR+R86ZRlc5uL/AqY+Z5k3GXv2JRtksi7pixlsIKpEBXbADmUaaLH04/KqK1GmuvCuq1AKSUkAgjQgjnUSsuz+wWy8v3NLBfUpzfYacAKGP5R148ieVZPivg08u+Nlb1vo/3JMjGdklJEDwTZ67OQm7ZCDEt6R2gZWd1TgHHVR/Cn9fhUA23bUxfEqxXFFd2x9j7t11obvetOg8mx/vfCtn7Rm05y5S38Ox+UUwWVFFwkNq/wA9Y5tA/lHXzPDkONH0+umrDh5VP4v3ZQvtjBeXX+L+RSlKaUhSlbDHLNcchvkWzWpgvTJS9xA6JHVSvJIHEmlSbekKk29Isb2ZsRVfs3F7ktawLNo5qRwW+fcHy4q+QrrCo9s9xWBhuLRbHBAV2Q3nndNC86feWfj+gAFSGtrHq8uGvc38anyoa9xSlKnLApSlACoJth2dwc8sgSCiNdooJhyiOXmhfmg/pzFb3Mcwx3EoQlX65tRAvXs2/ecc/lQOJqoL/wC0fEQ4pFhxt+QgHg7MeDYI/lSCf1qC6ytLjNle+2lLjYyg77ablYrs/artEciTI6t1xtf6EHqD0I51hV1Y6zg23PFkuNr7rdoyOY0EmGo9CPxtk/I+hrnraDguQ4RcO73iNvRlqIYmNAll0fHof4Tx+NZltDh6o9UZF2O4eqPWPyRilKlmzTAr3nd27tbkdhCaUO9TVp8DQ8h+ZXkProKhjFyekV4xcnqK6mNs8wy65xf0Wm2I3WxoqVJUnVDCPM+ZPQdT867WsVvTarNDtiH35CYrKGUuvK3lrCRpqo9TWvwfFLPh9iatFnj9m2nxOOK4uPL6rWep/p0ra3GbFt8F+dNfbjxmEFx11w6JQkcyTWvj0KqPXubmNjqiO33MTKL7bcbsUq83aQGYkdG8o9VHolI6qJ4AVxdtFy645rkz15nkoR7kWPrqlhrXgkevUnqa322naNJzu9huMXGbHEUe6MngXDy7VY8z0HQepNV/VLKyPMfFdjPzMnzXxj2QrLs1ynWe7RrrbZCo8yK4HGnB0I8/MHkR1FYlKqJ66opJ66o7X2U5xAzrGm7ixuszGtG5sYHi05p0/hPMH+xqUT44mQX4inXWg82psraVurTqNNUnofI1xBs/y26YXkjN5tit7TwSI5OiH29eKT/UHoa7Nw3JLXlePx71aH+1jvDik+82oc0KHRQrXx71bHT7m5i5Kujxl3OPdp2C3XBL+qBNCn4bxKocwDwvJ8j5LHUfPlUUru7LcctOVWN+z3qKH4zo1HRTauiknooedci7U9nV5wO57kkKlWt1ekWclPhV5JX+VfpyPSqeTjOt8o9jPysR1PlHt+hC6UqQ4LhmQZpc+5WOIVpSR20lzUMsjzUrz9BxNVYxcnpFRRcnpGntVvm3W5MW22xXZcyQrdaZbGqlH9h69K642K7NIuC2kyJfZyL3KQO8vjiGx/2aPQdT1PyrU2u1YRsPxhVxnviTdn0bpdIBfkq/I2n8KP8A+k1GrJ7SEdT27esYdZaKuDkSQFlI9UqA1+tX6YV0Pdj6/oaVEK8eW7X6v0OgBSo5hWbYzmEZT1hubchaBq6woFDrf8yDx+fKpHWhFqS2jUjJSW0xSlKUUUpSgCE7QNmGK5q+Jl1jPtT0oDaZcd0pWEjkCDqCOPUVVV79m+alSlWTJmXE9ETGCk/7SNf6V0XSoZ0Vz6tEFmNVY9yRyczsh2q41c27nZGmjKYOrb8KYkK+GitNQfI6irbxXK7/AHO3mw7TMDnNBxO4uUiH20V31WlOu4fUaj4Va1KbDHVb9LGV4qrfpb18exSdy9nrG5eQsToFzlxLSo778EeIkcwELPFIPrqfKresVot1jtbNstMNqJEZGiGmxoB6+p8yeJrOpUkKoQe4olrphW24rR5SpDEWM5JkuoZZaSVuOLVolKRzJPQVyht02pO5nMVZrO4tqwML58jLUPxK/gHQfM9NOhdquFu5xjv2Qi9yrWne31BpIUh7TklwcynXoCPnXMuZ7I82xgrdctpucNPHvMHVwAeake8n6aetVcx2a1FdCnnSta4xXQgVKHgopPBQ4EHmKVmGQKUpSAKmOynPrlgV+70xvSLdIITNia8HE/mT5LHQ9eRqGkgDUkCpZh2zrMMrUlVqszyYyv8ArUkdkyPgT73yBqSvlyTh3JKufJOHc7Jxq92zIrLHu9olIkxJCdUrHMHqkjoRyIrIu1ug3W3vW+5RGpcR9JS606nVKhVfbFtmczAUSHZOQvTHJSR2sVpO7GSofiAPEq6a8PhVl1twblH1LqdBW5Sj61plJsezxjbeSuzX7nMcsw8bcDkoHqlTnMp+h9a3WR5Lc7BbBYNmeBTpRbG4h7uhZiNHzG9oXD68vU1aRpTFTGP+nQYseMU1Dps5RnbKdrWWXRd1vrLfeXvedmTEeEeQSnXdA8gK39k9nC5LUlV6yaMynqiGwVn/AGlaf0ro+lRrEr7vqRLBq3t7ZBNn+ynE8MmJuFvYkSbilBSJcl3eUARoQANEjX4VO6UqxGKitItQhGC1FaFKUpw4UpSgBSlKAFKiUbaHjMjaS/s/bkvG+MMdspBZPZkboUUhXLe3SDpWyznKLThuMysivbrjcGKE7/Zo31qKlBKQkdSSRTuEtpa7gbulazGb7bcixyFkFseLkCayHmlrTundPmDyI46/Cq4yT2h9mFkuS4CrtInuNqKVrhRy62COfi4A/LWnRqnN6itgW1TSops+2h4jnkZx3Grs3KcZAL0dSS282DyJQrjp6jUetfW0PaDieBQWpWTXREUva9iylJW67pz3UjjoPPl60nlz5cddQPrK8AxDJ95V4sUR54/69CezdH/jTofrVa3r2cbC+srtF/uEEdEPIS8n68D+tb7E9vuzfIry1aWblKgSn1BDInxiylxR5AK4gE9NdNal+0HN8dwSzt3XJJio0d14MtBDSnFrWQToEj0BNR2Ye5cZQ6shnRVZ/sik1+zddA5ojKoZR5mIoH6b1be0+zdbkKSq65PMfHVEaOlrX5kqrdxvaP2UvPJbN6lt6nTeXBc0Hx0Bqw5eV2FjDncvFwafsrUYyu8sHfSpsDXVOnM9NPPhTH4fGD9UH+ZGsOj4NJiuyvBscUl2FY2X5CeUiX98v5b3AfICpqEgAADQDkBUDVtdwlvZ1Hz16e+1ZpD3d0KVHV2na6kbhQNTr4T6VGx7SOywjUXOeR/3ByrEMWa6Rh+RPGMYLSWi4aVBNnW1nCs+uki145cHnpcdnt1tux1N+DUDUEjQ8SPrTNtrWE4flUPG75cHWp0kJUdxkrQwlR0SXFD3QT+nHlR5U+XHXUfsndKAgjUcQaiWLbQ8ZyXL71itqkvOXKzHSUlbJSg6K3Tuq/ForgaYotptewEtpSlIApSlAClKUAKUpQApSlAHIuWZdBwf2urxkdyiy5UZhsNluMkKcJXGQBoCRWTty2543nGzidjlus97jSX3WVpckspS2AhxKjqQo9BW6szRX7clyCmioCKpZBTw3e6oAPw14a1O/a1YQNht4U2ynwvRlKKUch2yNT8K1uVatqTXXS67GLsV/lV9mWP2K7AILqmnLg01CWtJ0IbWpZWAfUJI+dWP7POAY7Y9l9nkm1wpE+5RESpch1lK1LLg3gnUjgkAgaDhwqLwsJlZz7ItjscRITcEQm5UNKzuhTiFKISSeW8kka+orRbKNvFrwrFI+HbQrZdrbc7Ojuzau7FRcbT7oUkkEKA0HkdNdajnGVlco19+T2Ka7apa4WzH2kcTveMMpgR7qtHeYrI3W/E6G3AEjklQUDpy1Gtbj2k7Hklp2r2HaPFx5WSWeAwhD0XcLiWlIUoneSASAd4EK0IBHGtRZVXfbtt0tmVNWmTBxOxKQW3X06b4QrfCdeRWtemoGu6kc/OZbXs1zPZztgt2QzjOmYFJjJYeYYbCkMr47yjw4LB0UNSNRqKfuSnCPeST3+33gQ7K892RbYo9vtWRC4YddI76S1MUwghIPAtlwcknzUBoQDW+9t1tKNnGOttLLiU3DdQoq1Kh2KtDr1+NRDb/AJzg21CBb7LgdjkXfJHpSSmS1BLa0o0IKCdNVa6jnwGmutbr2rbXOs2wjCbZOWp2TBdajvuDiO0EdSefxGg86dCHGyvuur6MR9j2zvaPsWmbIHrSj7PuF2XbEsstswClxEjswArfKRu7quJOvTrXzs8t10t/sZZL9ptPNJktSn4qHAQQyrd0IB5AqCiPjr1q6cQwfEGbFaZJxOyold0ZUpZgN74XuDUk6a6615bekE7F8rQ2gki2O8EjoBVbz49K4p90+ouiG+yfAg3LYNDiXGFGmR1TZJU1IaS4gkOnTUEEVBNu9kssL2jtn1vh2i3xocju/bR2oyENu6yFA7yQNDw4casX2PgobD7eopIC5clSSRzHaniPSoX7QSFn2nNm2iFHe7Dd0HPSSonT4DjUkG/8qf4h7F/RbVjuOx5U+Fa7ba20tFch2PGQ14EjU7xSBqBzrkWPi03a7Zdpe0h5l1TyHAbSnjyb8SkDz0aCU6eZq7/a4yd7H9kkiHFDgkXl9MAKSD4UEFS+PmUpKR/NUSwv2fsij4rBSnabfrIZDKXn4ERBS004tIKk++NT0J06U3Gkqq3Y5abfT8AZYvs3Zh/plsptcp50OToKe5S+PErbAAUf5k7p+ZqsvZ0/6Sm0f/zH/uhWL7PjE/Zrt8vmzOW47IizmO1Yd3N0L3E76HdOmqCpJ9QBUdwvPbRs12/Z5cchi3BTUqQ+whEdkKWFdvvgkEjhoOdSeV1sUOu1tf8A0TfY7CpVT4Lt8wvMMpiY5bIl7bmS94NKfigI1Skq4lKjpwB46aVbArOnXKt6ktD97FKUpgClKUAKUpQApSlAFXX3O5lq2n/Y67RaYaFPx4rT80rZenNuaFSmXt3szuE6dmpW8Sk6aaipBLz3FXYaRL7ZcZ8z21JcilST3PXt9U8dR4Tpw40vGzuzXS7vTpM26iPJlMzJNvTK/wAK+81u7i1JIJHuI1CSAd0ag14sbMrEzdnLiifeQS5McaZEzRuOqVr2xb0AKSSSQdSQeXDhU262kB9w9olhcxpu7xIFzMXtkxmmm4o1OqN8EEHcCN3rvaDkdDwrU3faVs/kRYc6XBfuLL0BFx7X7N7UMR1OFsrWSPCAoEH96y2tk+OtsBKZlz7bv6Z6n99sFTqWi0NUBHZkbpP4ddfFrrxr7Y2UYuzZnrUldxMd21G1K1kaqDHbKd4HT3t5Z4+WlL9UvkQ2CM3x+PlcfFOxlx5Drqo8dZj7jC3Eo7QpSeZ8PXTd6a617Qr8ufn96xN+EyY0KBGkhwnUuF1TgKSk8NBuD61gt7NrC3lSciTJuPekXA3BKC8koDxb7M/h3ikpPulRA6aVk3fBoU/KHcjYvN8tk59lph/uMoIQ6hsqKQoFJ/Mr601+X7fH5imktecYtCv1wZYgNw4DaH0xpTMAoTLcjhSpCErAAUUhJ0HXdVoTpXu7tKw2ZaZEm4x5jTLLMeW2xNglKpDbyt1lbSVe9qvwjloeenOtFkdhwe33afaU3uai5rZkuQ7c52j0aE9MStBdCUIJTvFS/eUQNVaAa1uLZsnsgsPcrxMuNxlLhRYpfdkbxjiOQtAZ1TwSHPF4gSeR1HCpGqu72BkSdqmOMWNF47pd3ovelQ3exib6mZAWEdkoA8VkqGgTrqDqK3WWZXa7F3KLMjTZUm4pc7GJGjF5xSEJ1cUpI5JSCNfiBxNQqPj2D3LIoNpiZhd/te2PSVsBp5KQXjoHSkdn2RWgeHRA1QCeA1NTDMMYtdzahXKfc7hAetDbpTOjPhtwNKRo6FnQgpUEgnhrqARoaY1Wmu/97ARfH9rOMx8asb1yZ7g5MgMTHmorWrENt1ZQgq5EJKteQJ4EkAVIMsyJiyZnY490gxfs6XHlKRPX78d9pAc3BqOAU2HDrrr4ai+KYjs8vjcH/Ru5XNSLfAjxStKVJ7xHQoqa3luN8eJV4kEEg8TppU3z3D7Pm1iFmvaXzHD6H0qYc7NaVJ8leRBKT5hRFLLy1PswIrb9pFqkWexqyuzvRX7oGHkp7v2jDHbOER95SuayN0ndB3SeOleje1W1Qbe69fWHWpAn3BhDERPaK7CK6ULeVqRoAACRz1OgBrY5Bszx683pV0fensrUIwLTDqUoHd17zW7qklOh5gEA9Qa+bhsxx6WUOJenxpCJEt4PtrQV/wCKc7R1HjSobu9oRw1TpwNG6hD5VtDxA5KzFbZkvSHFxowntwyWk95QHGEl3oF6jT156VjXLaDjr9ru9xiW6Q4mFEkSGZsq3r7rJDB3V7jgBKgFcOhPTWtsvZ/YVvvPFUwKemQpivvtfvIiUpa5jloka+dYaNmVjTb59s+0L0bZLjyI6IPfPuYyH1bznZp0568ioq3eQ0pE6vtFPVOaY1DymJYVw348yW4lhp8RNxpbqm+03ArmfD103deGuvCpnUKOzSwHJk3/ALxcRIRObnpb7ZO4HkN9mD7u9ulPDd13RxIANTUUyfHpxAUpSmAKUpQApSlAClKUAKUpQApSlAClKUAV1ecPvytpUvJ4HdXo0pmK32arpJiKQWVLJKktApcB3uSvIjrU8Kpv2klIbY7j2JJXvnte13hoN3TTd0146666cKyadaWU3LWwK2x/CL/btoIvSZECJb+9Sn5CYrzu7NDuu5vR1AoacSSCpxB1Vpy4mpjd4lxudnvdtdEVlMllxiI4lalEpW3pvLGnAhRPAa8APhW4pSuxy02BCNlOOXrGbWi3XRLBS1FZZS43dJErfUhO6SEOgBsddE/DoKm9KUkpcntgKUpSAKUpQApSlAClKUAKUpQB/9k=';


function switchModule(moduleName, evt) {
  const e = evt || window.event;

  // Ocultar todos los módulos
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));

  // Activar módulo seleccionado
  const mod = document.getElementById(moduleName);
  if (mod) mod.classList.add('active');

  // Nav activo
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = Array.from(document.querySelectorAll('.nav-item'))
    .find(n => {
      const onclick = n.getAttribute('onclick') || '';
      return onclick.includes(`'${moduleName}'`) || onclick.includes(`"${moduleName}"`);
    });
  if (nav) nav.classList.add('active');
  else if (e && e.target) {
    const closest = e.target.closest ? e.target.closest('.nav-item') : null;
    if (closest) closest.classList.add('active');
  }

  // Título
  const titles = {
    dashboard: '📊 Dashboard Ejecutivo',
    inventario: '🗂️ Inventario Maestro',
    equipos: '🔧 Gestión de Equipos',
    mantenimientos: '📋 Historial de Intervenciones',
    mantenimientos: '🔧 Mantenimientos · Preventivo & Correctivo',
    metrologia: '⚖️ Cronograma de Metrología / Calibración',
    planificacion: `📅 Cronograma de Mantenimiento Preventivo ${new Date().getFullYear()}`,
    repuestos: '📦 Gestión de Repuestos',
    documentos: '📄 Gestión Documental',
    'hv-personal': '👤 Hojas de Vida · Personal de Mantenimiento',
    kpis: '📈 Indicadores de Desempeño',
    reportes: '📝 Reportes e Informes',
    auditoria: '🔍 Auditoría y Trazabilidad',
    'hojas-vida': '📋 Hojas de Vida · SLV-GAT-GAB-12-F02',
    aprobar: '✅ Aprobar Mantenimientos · Preventivos & Correctivos',
    'inventario-servicio': '🏥 Inventario por Servicio'
  };
  const t = document.getElementById('moduleTitle');
  if (t) {
    if (moduleName === 'inventario-servicio') {
      t.innerHTML = `<span style="display:inline-flex;align-items:center;gap:12px;"><img src="${HOSPITAL_LOGO_DATA_URI}" alt="Logo Hospital" style="width:34px;height:34px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);background:#fff;padding:2px;"><span>Inventario por Servicio</span></span>`;
    } else {
      t.textContent = titles[moduleName] || moduleName;
    }
  }

  // Cargar datos del módulo
  loadModuleData(moduleName);
}

function loadModuleData(moduleName) {
  console.log(`Cargando datos del módulo: ${moduleName}`);
  switch (moduleName) {
    case 'dashboard':
      initDashboard();
      break;
    case 'inventario':
      if (typeof loadInventario === 'function') loadInventario();
      break;
    case 'equipos':
      loadEquipos();
      break;
    case 'mantenimientos':
      if (typeof loadMantenimientosModule === 'function') loadMantenimientosModule(false);
      break;
    case 'documentos':
      if (typeof loadDocumentos === 'function') loadDocumentos(false);
      break;
    case 'metrologia':
      const meYl = document.getElementById('meYearLabel');
      if (meYl) meYl.textContent = new Date().getFullYear();
      if (typeof loadMetrologia === 'function') loadMetrologia(false);
      break;
    case 'planificacion':
      // Set year label
      const yl = document.getElementById('crYearLabel');
      if (yl) yl.textContent = new Date().getFullYear();
      if (typeof loadCronograma === 'function') loadCronograma();
      break;
    case 'kpis':
      loadKPIs();
      break;
    case 'hojas-vida':
      if (typeof loadHojasVida === 'function') loadHojasVida(true);
      break;
    case 'hv-personal':
      if (typeof loadHVPersonal === 'function') loadHVPersonal(true);
      break;
    case 'aprobar':
      if (typeof loadAprobarModule === 'function') loadAprobarModule(false);
      break;
    case 'inventario-servicio':
      if (typeof loadInventarioServicio === 'function') loadInventarioServicio(false);
      break;
  }
}

// ============================================================================
// MODALES
// ============================================================================

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  // Soporta ambos estilos de modal (display y class)
  el.style.display = 'block';
  el.classList.add('active');

  // Inventario: cargar el próximo ITEM (Airtable Autonumber) solo para visualizar
  if (modalId === 'newInventario') {
    // Reset edit state — ensures clicking "Nuevo Registro" always creates, not updates
    if (typeof _invState !== 'undefined' && _invState) _invState.currentEditId = null;
    if (window.__HSLV_INVENTARIO_STATE) window.__HSLV_INVENTARIO_STATE.currentEditId = null;
    // Reset form fields for a clean slate
    var _invForm = document.getElementById('inventarioForm');
    if (_invForm) {
      _invForm.reset();
      var _submitBtn = _invForm.querySelector('button[type="submit"]');
      if (_submitBtn) _submitBtn.textContent = 'Guardar equipo';
    }
    loadNextInventarioItem().catch(() => {});
  }
}

// Carga el próximo ITEM (max + 1) desde Airtable para mostrarlo en el formulario.
async function loadNextInventarioItem() {
  const itemEl = document.getElementById('invItem');
  if (!itemEl) return;
  itemEl.value = '';
  itemEl.placeholder = 'Cargando...';

  const res = await fetch('/.netlify/functions/inventario?nextItem=1', { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || !data.ok) {
    itemEl.placeholder = '—';
    return;
  }
  itemEl.value = String(data.nextItemDisplay || data.nextItem || '').trim() || '';
  if (!itemEl.value) itemEl.placeholder = '—';
}

function closeModal(modalId) {
  // Si se llama sin argumento (desde inventario-module.js), cierra equipoModal
  if (!modalId) {
    const equipoModal = document.getElementById('equipoModal');
    if (equipoModal) {
      equipoModal.classList.remove('active');
      equipoModal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    return;
  }
  const el = document.getElementById(modalId);
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('active');
  document.body.style.overflow = 'auto';
}

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (event) => {
  document.querySelectorAll('.modal, .inventario-modal').forEach(m => {
    if (event.target === m) {
      m.style.display = 'none';
      m.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });
});

// ============================================================================
// DASHBOARD
// ============================================================================

function initDashboard() {
  // Mostrar estado de carga en todas las tarjetas
  ['kpiEquipos','kpiCumplimiento','kpiPendientes','kpiTotalReportes',
   'kpiPreventivos','kpiCorrectivos','kpiTerceros','kpiEquiposManto',
   'kpiVencidos','kpiPendientes30d',
   'kpiPrevAprobados','kpiPrevRechazados','kpiPrevPendientes','kpiCorrAprobados','kpiCorrRechazados','kpiCorrPendientes'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '⏳';
  });
  fetchDashboardData();
}

function initMTBFChart() {
  const ctx = document.getElementById('mtbfChart');
  if (!ctx || typeof Chart === 'undefined') return;

  // Destruir chart previo si existe
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
      datasets: [
        { label: 'MTBF (Horas)', data: [2400,2500,2450,2600,2700,2750,2800,2850,2900,2920,2870,2847], borderColor: '#0d47a1', backgroundColor: 'rgba(13,71,161,0.05)', tension: 0.4, fill: true },
        { label: 'MTTR (Horas)', data: [5.2,5.1,5.0,4.9,4.8,4.7,4.6,4.5,4.4,4.3,4.2,4.2], borderColor: '#ff6f00', backgroundColor: 'rgba(255,111,0,0.05)', tension: 0.4, fill: true }
      ]
    },
    options: { responsive: true }
  });
  ctx._chartInstance = chart;
}

function initComplianceChart() {
  const ctx = document.getElementById('complianceChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Cumplido','Pendiente'],
      datasets: [{ data: [92,8], backgroundColor: ['#2e7d32','#c62828'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
  ctx._chartInstance = chart;
}

function initMaintenanceTypeChart() {
  const ctx = document.getElementById('maintenanceTypeChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Preventivo','Correctivo','Calibración'],
      datasets: [{ data: [55,35,10], backgroundColor: ['#1565c0','#ff6f00','#2e7d32'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });
  ctx._chartInstance = chart;
}

async function fetchDashboardData() {
  console.log('[DASH] Iniciando fetchDashboardData...');
  try {
    const response = await axios.get(`${API_BASE_URL}/kpis`, { headers: getAuthHeader() });
    const data = response.data || {};
    console.log('[DASH] Respuesta KPIs:', JSON.stringify(data).slice(0, 500));

    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    // KPIs principales
    setText('kpiEquipos',      data.equiposTotal ?? 0);
    setText('kpiCumplimiento', (data.cumplimiento ?? 0) + '%');
    setText('kpiPendientes',   data.pendientes ?? 0);
    setText('kpiMTBF',         '—');
    setText('kpiMTTR',         '—');
    setText('kpiCosto',        '—');

    // KPIs adicionales
    setText('kpiTotalReportes',  data.totalReportes ?? 0);
    setText('kpiPreventivos',    data.totalPreventivos ?? 0);
    setText('kpiCorrectivos',    data.totalCorrectivos ?? 0);
    setText('kpiTerceros',       data.totalTerceros ?? 0);
    setText('kpiEquiposManto',   data.equiposConManto ?? 0);
    setText('kpiVencidos',       data.vencidos ?? 0);
    setText('kpiPendientes30d',  data.pendientes30d ?? 0);

    // KPIs de aprobados
    const prevAprobados  = data.prevAprobados  ?? 0;
    const prevPendientes = data.prevPendientes ?? 0;
    const corrAprobados  = data.corrAprobados  ?? 0;
    const corrPendientes = data.corrPendientes ?? 0;
    setText('kpiPrevAprobados',  prevAprobados);
    setText('kpiPrevRechazados', data.prevRechazados  ?? 0);
    setText('kpiPrevPendientes', prevPendientes);
    setText('kpiCorrAprobados',  corrAprobados);
    setText('kpiCorrRechazados', data.corrRechazados  ?? 0);
    setText('kpiCorrPendientes', corrPendientes);

    // Gráfica: distribución de tipos
    _updateDistribucionChart(data.distribucion || {});

    // Gráfica: top servicios
    _updateServiciosChart(data.topServicios || []);

    // Gráfica: tendencia mensual
    _updateTendenciaChart(data.tendencia || []);

  } catch (error) {
    console.error('[DASH] Error cargando dashboard:', error?.response?.data || error?.message || error);
    // Mostrar error en las cards
    ['kpiEquipos','kpiCumplimiento','kpiPendientes','kpiTotalReportes'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '⏳') el.textContent = '—';
    });
  }
}

function _updateDistribucionChart(dist) {
  const ctx = document.getElementById('maintenanceTypeChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const prev = dist.preventivo || 0;
  const corr = dist.correctivo || 0;
  const terc = dist.terceros   || 0;
  const total = prev + corr + terc || 1;
  ctx._chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `Preventivo (${prev})`,
        `Correctivo (${corr})`,
        `Terceros (${terc})`
      ],
      datasets: [{
        data: [prev, corr, terc],
        backgroundColor: ['#1565c0', '#c62828', '#1b5e20'],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const val = ctx.raw;
              const pct = Math.round(val / total * 100);
              return ` ${val} reportes (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function _updateServiciosChart(servicios) {
  const ctx = document.getElementById('complianceChart');
  if (!ctx || typeof Chart === 'undefined' || !servicios.length) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  const labels = servicios.map(s => s.nombre.length > 20 ? s.nombre.slice(0,18)+'…' : s.nombre);
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Equipos', data: servicios.map(s => s.equip), backgroundColor: '#1565c020', borderColor: '#1565c0', borderWidth: 2 },
        { label: 'Preventivos', data: servicios.map(s => s.prev), backgroundColor: '#4db84880', borderColor: '#4db848', borderWidth: 2 },
        { label: 'Correctivos', data: servicios.map(s => s.corr), backgroundColor: '#c6282880', borderColor: '#c62828', borderWidth: 2 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function _updateTendenciaChart(tendencia) {
  const ctx = document.getElementById('mtbfChart');
  if (!ctx || typeof Chart === 'undefined' || !tendencia.length) return;
  if (ctx._chartInstance) ctx._chartInstance.destroy();
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tendencia.map(m => m.label),
      datasets: [
        { label: 'Preventivos', data: tendencia.map(m => m.prev), backgroundColor: '#1565c0cc', borderRadius: 6 },
        { label: 'Correctivos', data: tendencia.map(m => m.corr), backgroundColor: '#c62828cc', borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

// ============================================================================
// EQUIPOS / MANTENIMIENTOS / KPIs
// ============================================================================

async function loadEquipos() {
  try {
    const response = await axios.get(`${API_BASE_URL}/equipos`, { headers: getAuthHeader() });
    console.log('Equipos cargados:', response.data);
  } catch (error) {
    console.error('Error cargando equipos:', error);
  }
}

async function loadMantenimientos() {
  try {
    const response = await axios.get(`${API_BASE_URL}/mantenimientos`, { headers: getAuthHeader() });
    console.log('Mantenimientos cargados:', response.data);
  } catch (error) {
    console.error('Error cargando mantenimientos:', error);
  }
}

async function loadKPIs() {
  try {
    await axios.get(`${API_BASE_URL}/kpis`, { headers: getAuthHeader() });
    const ctx = document.getElementById('kpiDetailChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (ctx._chartInstance) ctx._chartInstance.destroy();
    const chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['MTBF','MTTR','Cumplimiento','Disponibilidad','Eficiencia','Confiabilidad'],
        datasets: [{ label: 'Desempeño Actual', data: [85,90,94,92,88,86], borderColor: '#0d47a1', backgroundColor: 'rgba(13,71,161,0.1)', borderWidth: 2 }]
      },
      options: { responsive: true, scales: { r: { beginAtZero: true, max: 100 } } }
    });
    ctx._chartInstance = chart;
  } catch (error) {
    console.error('Error cargando KPIs:', error);
  }
}

// ============================================================================
// INVENTARIO - Formulario del modal "newInventario"
// (El formulario con campos UPPERCASE que usa <details>)
// ============================================================================

async function submitInventarioForm(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const rawFields = {};

  // Certificados de calibración (PDF) - se envían aparte, no dentro de fields
  const certificates = [];

  // PDF Manual del Equipo
  let manualFile = null;
  const _manualInput = form.querySelector('#manualFileInput');
  if (_manualInput && _manualInput.files && _manualInput.files[0]) {
    const _mf = _manualInput.files[0];
    if (_mf.size > 5 * 1024 * 1024) { alert('El PDF del Manual supera 5MB.'); return; }
    manualFile = _mf;
  }

  // PDF Manual de Servicio
  let manualServicioFile = null;
  const _manualServicioInput = form.querySelector('#manualServicioFileInput');
  if (_manualServicioInput && _manualServicioInput.files && _manualServicioInput.files[0]) {
    const _msf = _manualServicioInput.files[0];
    if (_msf.size > 5 * 1024 * 1024) { alert('El PDF del Manual de Servicio supera 5MB.'); return; }
    manualServicioFile = _msf;
  }

  // PDF Registro INVIMA
  let invimaFile = null;
  const _invimaInput = form.querySelector('#invimaFileInput');
  if (_invimaInput && _invimaInput.files && _invimaInput.files[0]) {
    const _if = _invimaInput.files[0];
    if (_if.size > 5 * 1024 * 1024) { alert('El PDF del Registro INVIMA supera 5MB.'); return; }
    invimaFile = _if;
  }

  // PDF Registro de Importación
  let importacionFile = null;
  const _importInput = form.querySelector('#importacionFileInput');
  if (_importInput && _importInput.files && _importInput.files[0]) {
    const _impf = _importInput.files[0];
    if (_impf.size > 5 * 1024 * 1024) { alert('El PDF del Registro de Importación supera 5MB.'); return; }
    importacionFile = _impf;
  }

  const _calId = document.getElementById('calibrableIdentSelect');
  const _calMn = document.getElementById('calibrableMainSelect');
  const esCalibrableSI = (_calId && _calId.value === 'SI') || (_calMn && _calMn.value === 'SI');
  // Guardar SI/NO en campo Calibrable de Airtable
  const _calibrableVal = (_calId && _calId.value && _calId.value !== '') ? _calId.value :
                         (_calMn && _calMn.value && _calMn.value !== '') ? _calMn.value : null;
  if (_calibrableVal === 'SI' || _calibrableVal === 'NO') {
    rawFields['CALIBRABLE'] = _calibrableVal;
  }
  try {
    const rows = form.querySelectorAll('#calCertList .cal-cert-row');
    rows.forEach((row) => {
      const yearEl = row.querySelector('input[name="CAL_CERT_YEAR"]');
      const fileEl = row.querySelector('input[name="CAL_CERT_FILE"]');
      const year = yearEl ? String(yearEl.value || '').trim() : '';
      const file = fileEl && fileEl.files ? fileEl.files[0] : null;
      if (!year && !file) return;
      if (!esCalibrableSI) return;
      if (!year || !/^[0-9]{4}$/.test(year)) throw new Error('El año de calibración debe ser 4 dígitos.');
      if (!file) throw new Error('Falta adjuntar el PDF del certificado para el año ' + year + '.');
      if (file.size > 5 * 1024 * 1024) throw new Error('El PDF de ' + year + ' supera 5MB.');
      if (file.type && file.type !== 'application/pdf') throw new Error('El archivo de ' + year + ' debe ser PDF.');
      certificates.push({ year, file });
    });
  } catch (e) {
    alert(e.message || String(e));
    return;
  }

  for (const [k, v] of fd.entries()) {
    // Ignorar inputs de certificados (se manejan arriba)
    if (k === 'CAL_CERT_YEAR' || k === 'CAL_CERT_FILE' || k === 'CALIBRABLE_IDENT') continue;

    // Ignorar archivos/adjuntos genéricos en este flujo (solo soportamos PDFs por el componente de certificados)
    if (v instanceof File) continue;

    let val = String(v);
      val = val.replace(/[\u00A0\s]+/g, ' ').trim();
      val = val.replace(/^[\s'\"“”‘’]+/, '').replace(/[\s'\"“”‘’]+$/, '');
    if (val === '') continue;
    if (k === 'CALIBRABLE' || k === 'Calibrable') {
      if (val === 'SI' || val === 'si' || val === 'true') rawFields[k] = 'SI';
      else if (val === 'NO' || val === 'no' || val === 'false') rawFields[k] = 'NO';
    } else if (k === 'CALIBRABLE_IDENT') {
      // solo UI, ignorar
    } else {
      rawFields[k] = val;
    }
  }

  if (!rawFields['EQUIPO'] && !rawFields['Equipo']) {
    alert('El campo EQUIPO es obligatorio');
    return;
  }

  // Mapeo UPPERCASE → nombres exactos de columnas Airtable
  const FIELD_MAP = {
    'ITEM': 'Item',
    'EQUIPO': 'Equipo',
    'MARCA': 'Marca',
    'MODELO': 'Modelo',
    'SERIE': 'Serie',
    'PLACA': 'Numero de Placa',
    'NUMERO DE PLACA': 'Numero de Placa',
    'CODIGO ECRI': 'Codigo ECRI',
    'REGISTRO INVIMA': 'Registro INVIMA',
    'TIPO DE ADQUISICION': 'Tipo de Adquisicion',
    'NO. DE CONTRATO': 'No. de Contrato',
    'SEDE': 'Sede',
    'DISTINTIVO HABILITACION': 'Distintivo habilitacion',
    'DISTINTIVO HABILITACIÓN': 'Distintivo habilitacion',
    'CODIGO DE PRESTADOR': 'Codigo de prestador',
    'CÓDIGO DE PRESTADOR': 'Codigo de prestador',
    'SERVICIO': 'Servicio',
    'UBICACIÓN': 'Ubicacion',
    'UBICACION': 'Ubicacion',
    'VIDA UTIL': 'Vida Util',
    'FECHA FABRICA': 'Fecha Fabrica',
    // Certificados de calibración se guardan por API (adjuntos) y años en campo texto
    'FECHA DE COMRPA': 'Fecha de Compra',
    'FECHA DE COMPRA': 'Fecha de Compra',
    'VALOR EN PESOS': 'Valor en Pesos',
    'FECHA DE RECEPCIÓN': 'Fecha de Recepcion',
    'FECHA DE INSTALACIÓN': 'Fecha de Instalacion',
    'INICIO DE GARANTIA': 'Inicio de Garantia',
    'TERMINO DE GARANTIA': 'Termino de Garantia',
    'CLASIFICACION BIOMEDICA': 'Clasificacion Biomedica',
    'CLASIFICACION DE LA TECNOLOGIA': 'Clasificacion de la Tecnologia',
    'CLASIFICACION DEL RIESGO': 'Clasificacion del Riesgo',
    'MANUAL': 'Manual',
    'TIPO DE MTTO': 'Tipo de MTTO',
    'COSTO DE MANTENIMIENTO': 'Costo de Mantenimiento',
    'CALIBRABLE': 'Calibrable',
    'N. CERTIFICADO': 'N. Certificado',
    'FRECUENCIA DE MTTO PREVENTIVO': 'Frecuencia de MTTO Preventivo',
    'FECHA PROGRAMADA DE MANTENIMINETO': 'Fecha Programada de Mantenimiento',
    'FRECUENCIA DE MANTENIMIENTO': 'Frecuencia de Mantenimiento',
    'PROGRAMACION DE MANTENIMIENTO ANUAL': 'Programacion de Mantenimiento Anual',
    'RESPONSABLE': 'Responsable',
    'NOMBRE': 'Nombre',
    'DIRECCION': 'Direccion',
    'TELEFONO': 'Telefono',
    'CIUDAD': 'Ciudad',
    // Sección 6: Registro técnico de instalación
    'FUENTE DE ALIMENTACION': 'Fuente de Alimentacion',
    'TEC PREDOMINANTE': 'Tec Predominante',
    'VOLTAJE MAX': 'Voltaje Max',
    'VOLTAJE MIN': 'Voltaje Min',
    'CORRIENTE MAX': 'Corriente Max',
    'CORRIENTE MIN': 'Corriente Min',
    'POTENCIA': 'Potencia',
    'FRECUENCIA INSTALACION': 'Frecuencia Instalacion',
    'PRESION INSTALACION': 'Presion Instalacion',
    'VELOCIDAD INSTALACION': 'Velocidad Instalacion',
    'PESO INSTALACION': 'Peso Instalacion',
    'TEMPERATURA INSTALACION': 'Temperatura Instalacion',
    'OTROS INSTALACION': 'Otros Instalacion',
    // Sección 7: Registro técnico de funcionamiento
    'RANGO DE VOLTAJE': 'Rango de Voltaje',
    'RANGO DE CORRIENTE': 'Rango de Corriente',
    'RANGO DE POTENCIA': 'Rango de Potencia',
    'FRECUENCIA FUNCIONAMIENTO': 'Frecuencia Funcionamiento',
    'RANGO DE PRESION': 'Rango de Presion',
    'RANGO DE VELOCIDAD': 'Rango de Velocidad',
    'RANGO DE TEMPERATURA': 'Rango de Temperatura',
    'PESO FUNCIONAMIENTO': 'Peso Funcionamiento',
    'RANGO DE HUMEDAD': 'Rango de Humedad',
    'OTRAS RECOMENDACIONES DEL FABRICANTE': 'Otras Recomendaciones del Fabricante',
  };

  // Convertir campos del formulario a nombres de Airtable
  const fields = {};
  for (const [k, v] of Object.entries(rawFields)) {
    const mapped = FIELD_MAP[k] || k;
    fields[mapped] = v;
  }

  // "Item" en Airtable es Autonumber (solo lectura). Se muestra en la UI,
  // pero NO se debe enviar al backend en POST/PUT porque provoca error 422.
  if ('Item' in fields) delete fields['Item'];

  // Guardar años de calibración (texto) si hay certificados
  if (certificates.length > 0) {
    const years = Array.from(new Set(certificates.map(c => c.year))).sort();
    fields['Años de Calibracion'] = years.join(', ');
  }

  console.log('📤 Enviando campos mapeados:', fields);

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando...';
  }

  try {
    const url = `${API_BASE_URL}/inventario`;
    // Convertir PDFs a base64 para el endpoint backend (uploadAttachment)
    const certPayload = [];
    for (const c of certificates) {
      const b64 = await fileToBase64(c.file);
      certPayload.push({ year: c.year, filename: c.file.name, contentType: c.file.type || 'application/pdf', base64: b64 });
    }

    // Determinar si es edición (PUT) o creación (POST)
    const isEdit = !!(_invState && _invState.currentEditId);
    let resp;
    if (isEdit) {
      // ACTUALIZAR registro existente via PUT
      console.log('📝 Actualizando registro existente:', _invState.currentEditId);
      resp = await axios.put(url, { id: _invState.currentEditId, fields, certificates: certPayload }, {
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
      });
    } else {
      // CREAR nuevo registro via POST
      console.log('🆕 Creando nuevo registro');
      resp = await axios.post(url, { fields, certificates: certPayload }, {
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
      });
    }

    if (resp.data && (resp.data.ok || resp.data.record || resp.data.data)) {
      // Compatibilidad: el backend puede devolver {record} o {data}
      const record = resp.data.record || resp.data.data || null;
      const newRecordId = resp.data.recordId || (record && (record.id || (record.records && record.records[0] && record.records[0].id))) || (isEdit ? _invState.currentEditId : null);
      console.log('🔍 resp.data completo:', JSON.stringify(resp.data).slice(0,300));
      console.log('📋 newRecordId:', newRecordId, '| manualFile:', !!manualFile, '| invimaFile:', !!invimaFile, '| importacionFile:', !!importacionFile);

      // Subir Manual, INVIMA e Importacion via upload-pdf (evitar límite 6MB de Netlify)
      const uploadUrl = `${API_BASE_URL}/upload-pdf`;

      // Helper para subir un PDF via upload-pdf — acumula errores para mostrarlos al usuario
      const pdfUploadErrors = [];
      async function uploadPdf(file, fieldName, label) {
        if (!file || !newRecordId) { console.log('⏭️ skip', label, '-- file:', !!file, 'recordId:', newRecordId); return; }
        try {
          const b64 = await fileToBase64(file);
          console.log('⬆️ subiendo', label, '->', fieldName, '| bytes b64:', b64.length);
          const r = await axios.post(uploadUrl, {
            recordId: newRecordId,
            fieldName: fieldName,
            filename: file.name,
            contentType: file.type || 'application/pdf',
            base64: b64
          }, { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } });
          if (r.data && r.data.ok === false) {
            const errMsg = r.data.error || 'Error desconocido';
            console.error('❌', label, 'error:', errMsg);
            pdfUploadErrors.push(label + ': ' + errMsg);
          } else {
            console.log('✅', label, 'subido correctamente');
          }
        } catch(e) {
          const errMsg = e.response ? JSON.stringify(e.response.data) : e.message;
          console.error('❌', label, 'error:', errMsg);
          pdfUploadErrors.push(label + ': ' + errMsg);
        }
      }

      await uploadPdf(manualFile,         'Manual',                  'Manual del Equipo');
      await uploadPdf(manualServicioFile,  'Manual de servicio',      'Manual de Servicio');
      await uploadPdf(invimaFile,          'Registro Invima pdf',     'Registro INVIMA');
      await uploadPdf(importacionFile,     'Registro de importacion', 'Registro de Importacion');

      // Avisar si algun PDF no se pudo subir
      if (pdfUploadErrors.length > 0) {
        alert('⚠️ El registro se guardo, pero los siguientes PDF NO se pudieron adjuntar:\n\n' +
          pdfUploadErrors.join('\n') +
          '\n\nVerifica que los nombres de los campos en Airtable coincidan exactamente.');
      }



      // Si el backend removió campos problemáticos, solo mostrar aviso si son campos CLAVE
      const removedSelects = (resp.data?.record && resp.data.record.__removedSelects) ||
                            (resp.data?.data && resp.data.data.__removedSelects) ||
                            resp.data?.__removedSelects;
      if (Array.isArray(removedSelects) && removedSelects.length) {
        // Campos opcionales/técnicos que se omiten silenciosamente sin molestar al usuario
        const SILENT_FIELDS = new Set([
          'Fecha de calibracion', 'Fecha Proxima Calibracion',
          'Programacion de Mantenimiento Anual', 'Años de Calibracion', 'N. Certificado',
          'Fuente de Alimentacion', 'Tec Predominante',
          'Voltaje Max', 'Voltaje Min', 'Corriente Max', 'Corriente Min',
          'Potencia', 'Frecuencia Instalacion', 'Presion Instalacion',
          'Velocidad Instalacion', 'Peso Instalacion', 'Temperatura Instalacion',
          'Otros Instalacion', 'Rango de Voltaje', 'Rango de Corriente',
          'Rango de Potencia', 'Frecuencia Funcionamiento', 'Rango de Presion',
          'Rango de Velocidad', 'Rango de Temperatura', 'Peso Funcionamiento',
          'Rango de Humedad', 'Otras Recomendaciones del Fabricante', 'Manual de servicio',
        ]);
        // Solo mostrar aviso para campos importantes que el usuario debería corregir
        const importantRemoved = removedSelects.filter(f => !SILENT_FIELDS.has(f));
        if (importantRemoved.length > 0) {
          alert('⚠️ El registro se guardó, pero estos campos no coincidieron con las opciones de Airtable: ' +
                importantRemoved.join(', ') +
                '.\nVerifica que el valor enviado coincida exactamente con las opciones configuradas en Airtable.');
        } else {
          console.log('ℹ️ Campos opcionales omitidos silenciosamente:', removedSelects);
        }
      }

      // Validación real: si Airtable devolvió un record pero sin fields, entonces sí es un problema.
      const sentCount = Object.keys(fields || {}).length;
      const recFields = (record && record.fields) ? record.fields : {};
      const recCount = Object.keys(recFields || {}).length;
      if (sentCount > 0 && recCount === 0) {
        console.warn('⚠️ Registro creado pero sin fields devueltos por Airtable.', { sent: fields, record });
        alert('⚠️ Se creó el registro pero Airtable no devolvió campos. Revisa nombres exactos de columnas y permisos del token.');
      }
      closeModal('newInventario');
      form.reset();
      // Reset edit state so next open creates a new record
      if (_invState) _invState.currentEditId = null;
      if (window.__HSLV_INVENTARIO_STATE) window.__HSLV_INVENTARIO_STATE.currentEditId = null;

      // Reset certificados y estado calibrable
      try {
        var _list = document.getElementById('calCertList');
        if (_list) { _list.innerHTML = ''; addCalCertRow(); }
        var _ids = document.getElementById('calibrableIdentSelect');
        var _mns = document.getElementById('calibrableMainSelect');
        var _css = document.getElementById('calCertSection');
        if (_ids) _ids.value = '';
        if (_mns) _mns.value = '';
        if (_css) _css.style.display = 'none';
        var _mi = document.getElementById('manualFileInput');
        if (_mi) _mi.value = '';
        var _msi = document.getElementById('manualServicioFileInput');
        if (_msi) _msi.value = '';
        var _ii = document.getElementById('invimaFileInput');
        if (_ii) _ii.value = '';
        var _imp = document.getElementById('importacionFileInput');
        if (_imp) _imp.value = '';
      } catch (e) {}

      if (typeof loadInventario === 'function') loadInventario();
      alert(isEdit ? '✅ Registro actualizado correctamente' : '✅ Registro guardado correctamente');
    } else {
      throw new Error('Respuesta inesperada del servidor');
    }
  } catch (err) {
    console.error('Error guardando inventario:', err?.response?.data || err.message);
    let msg = err?.response?.data?.error || err?.response?.data?.details?.error?.message || err?.response?.data?.details?.error || err.message;
    if (typeof msg === 'object') {
      msg = msg?.message || JSON.stringify(msg);
    }
    alert('Error guardando inventario: ' + String(msg));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

// ============================================================================
// INVENTARIO - Estado y carga de datos (reemplaza inventario-module.js si no carga)
// ============================================================================

var _invState = window.__HSLV_INVENTARIO_STATE || (window.__HSLV_INVENTARIO_STATE = {
  currentPage: 0,
  currentOffset: null,
  searchQuery: '',
  searchTimeout: null,
  allRecords: [],
  currentEditId: null,
  pageSize: 50
});

// Función principal de carga — se llama desde switchModule('inventario') y botón Actualizar
async function loadInventario(forceRefresh) {
  // Si inventario-module.js ya está cargado y tiene su propia implementación completa, usarla.
  // Detectamos si ya fue inicializada correctamente verificando que el módulo esté listo.
  if (window.__HSLV_INVENTARIO_MODULE_LOADED && typeof window.__invModuleLoadInventario === 'function') {
    return window.__invModuleLoadInventario(forceRefresh);
  }

  const tbody = document.getElementById('inventarioTbody');
  if (!tbody) { console.warn('⚠️ No se encontró #inventarioTbody'); return; }

  tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:18px;color:#607d8b;">⏳ Cargando inventario...</td></tr>`;

  try {
    const params = new URLSearchParams({ pageSize: '50' });
    if (_invState.currentOffset) params.set('offset', _invState.currentOffset);
    const q = (_invState.searchQuery || '').trim();
    if (q) params.set('q', q);

    const res = await fetch(`${API_BASE_URL}/inventario?${params}`, {
      headers: getAuthHeader()
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    _invState.allRecords = data.records || data.data || [];
    _invState.currentOffset = data.offset || null;

    const total = data.count || _invState.allRecords.length;
    const countEl = document.getElementById('inventarioCount');
    if (countEl) countEl.textContent = `${total} registros`;

    console.log('✅ Inventario cargado:', _invState.allRecords.length, 'registros');
    _renderInventarioTable();
    _updateInventarioPagination();

  } catch (err) {
    console.error('❌ Error cargando inventario:', err);
    tbody.innerHTML = `
      <tr><td colspan="11" style="text-align:center;padding:18px;color:#c62828;">
        ⚠️ Error al cargar el inventario: <strong>${escapeHtml(err.message)}</strong><br>
        <button class="btn btn-primary" onclick="loadInventario(true)" style="margin-top:10px">🔄 Reintentar</button>
      </td></tr>`;
  }
}

function _renderInventarioTable() {
  const tbody = document.getElementById('inventarioTbody');
  if (!tbody) return;

  if (!_invState.allRecords.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:18px;color:#607d8b;">
      📦 No hay equipos registrados.<br><small>Comienza agregando tu primer equipo al inventario.</small>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = _invState.allRecords.map(record => {
    const f = record.fields || {};
    const get = (...keys) => { for (const k of keys) { if (f[k] != null && f[k] !== '') return f[k]; } return ''; };
    const item     = get('Item','ITEM');
    const equipo   = get('Equipo','EQUIPO');
    const marca    = get('Marca','MARCA');
    const modelo   = get('Modelo','MODELO');
    const serie    = get('Serie','SERIE');
    const placa    = get('Numero de Placa','PLACA','Número de Placa');
    const servicio = get('Servicio','SERVICIO');
    const ubic     = get('Ubicacion','Ubicación','UBICACIÓN');
    const vida     = get('Vida Util','VIDA UTIL');
    const fecha    = get('Fecha Programada de Mantenimiento','FECHA PROGRAMADA DE MANTENIMINETO');

    let fechaStr = '—';
    if (fecha) {
      try { fechaStr = new Date(fecha).toLocaleDateString('es-CO', {year:'numeric',month:'short',day:'numeric'}); }
      catch(e) { fechaStr = fecha; }
    }

    const esc = escapeHtml;
    return `<tr>
      <td>${esc(String(item))}</td>
      <td>${esc(equipo)}</td>
      <td>${esc(marca)}</td>
      <td>${esc(modelo)}</td>
      <td>${esc(serie)}</td>
      <td>${esc(placa)}</td>
      <td>${esc(servicio)}</td>
      <td>${esc(ubic)}</td>
      <td>${esc(String(vida))}</td>
      <td>${fechaStr}</td>
      <td>
        <button class="btn btn-small btn-secondary" onclick="editEquipo('${record.id}')" title="Editar">✏️</button>
        <button class="btn btn-small" onclick="deleteEquipo('${record.id}','${esc(equipo)}')" title="Eliminar" style="color:#c62828;">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function _updateInventarioPagination() {
  const prev = document.getElementById('inventarioPrevBtn');
  const next = document.getElementById('inventarioNextBtn');
  if (prev) prev.disabled = (_invState.currentPage === 0);
  if (next) next.disabled = !_invState.currentOffset;
}

let inventarioSearchTimer = null;

function debouncedInventarioSearch() {
  clearTimeout(inventarioSearchTimer);
  inventarioSearchTimer = setTimeout(() => {
    const el = document.getElementById('inventarioSearch');
    _invState.searchQuery = el ? el.value.trim() : '';
    _invState.currentOffset = null;
    _invState.currentPage = 0;
    loadInventario();
  }, 400);
}

function inventarioNextPage() {
  if (!_invState.currentOffset) return;
  _invState.currentPage++;
  loadInventario();
}

function inventarioPrevPage() {
  if (_invState.currentPage <= 0) return;
  _invState.currentPage--;
  _invState.currentOffset = null;
  loadInventario();
}

// Editar y Eliminar — se exponen para los botones inline de la tabla
async function editEquipo(recordId) {
  // Mapeo inverso: nombre Airtable → nombre del input HTML (name attribute)
  const REVERSE_MAP = {
    'Item': 'ITEM',
    'Equipo': 'EQUIPO',
    'Marca': 'MARCA',
    'Modelo': 'MODELO',
    'Serie': 'SERIE',
    'Numero de Placa': 'PLACA',
    'Codigo ECRI': 'CODIGO ECRI',
    'Registro INVIMA': 'REGISTRO INVIMA',
    'Tipo de Adquisicion': 'TIPO DE ADQUISICION',
    'No. de Contrato': 'NO. DE CONTRATO',
    'Sede': 'SEDE',
    'Distintivo habilitacion': 'DISTINTIVO HABILITACION',
    'Codigo de prestador': 'CODIGO DE PRESTADOR',
    'Servicio': 'SERVICIO',
    'Ubicacion': 'UBICACION',
    'Vida Util': 'VIDA UTIL',
    'Fecha Fabrica': 'FECHA FABRICA',
    'Fecha de Compra': 'FECHA DE COMPRA',
    'Valor en Pesos': 'VALOR EN PESOS',
    'Fecha de Recepcion': 'FECHA DE RECEPCIÓN',
    'Fecha de Instalacion': 'FECHA DE INSTALACIÓN',
    'Inicio de Garantia': 'INICIO DE GARANTIA',
    'Termino de Garantia': 'TERMINO DE GARANTIA',
    'Clasificacion Biomedica': 'CLASIFICACION BIOMEDICA',
    'Clasificacion de la Tecnologia': 'CLASIFICACION DE LA TECNOLOGIA',
    'Clasificacion del Riesgo': 'CLASIFICACION DEL RIESGO',
    'Calibrable': 'CALIBRABLE',
    'Tipo de MTTO': 'TIPO DE MTTO',
    'Costo de Mantenimiento': 'COSTO DE MANTENIMIENTO',
    'N. Certificado': 'N. CERTIFICADO',
    'Fecha de calibracion': 'FECHA DE CALIBRACION',
    'Fecha Proxima Calibracion': 'FECHA PROXIMA CALIBRACION',
    'Frecuencia de MTTO Preventivo': 'FRECUENCIA DE MTTO PREVENTIVO',
    'Fecha Programada de Mantenimiento': 'FECHA PROGRAMADA DE MANTENIMINETO',
    'Frecuencia de Mantenimiento': 'FRECUENCIA DE MANTENIMIENTO',
    'Programacion de Mantenimiento Anual': 'PROGRAMACION DE MANTENIMIENTO ANUAL',
    'Responsable': 'RESPONSABLE',
    'Nombre': 'NOMBRE',
    'Direccion': 'DIRECCION',
    'Telefono': 'TELEFONO',
    'Ciudad': 'CIUDAD',
    // Sección 6
    'Fuente de Alimentacion': 'FUENTE DE ALIMENTACION',
    'Tec Predominante': 'TEC PREDOMINANTE',
    'Voltaje Max': 'VOLTAJE MAX',
    'Voltaje Min': 'VOLTAJE MIN',
    'Corriente Max': 'CORRIENTE MAX',
    'Corriente Min': 'CORRIENTE MIN',
    'Potencia': 'POTENCIA',
    'Frecuencia Instalacion': 'FRECUENCIA INSTALACION',
    'Presion Instalacion': 'PRESION INSTALACION',
    'Velocidad Instalacion': 'VELOCIDAD INSTALACION',
    'Peso Instalacion': 'PESO INSTALACION',
    'Temperatura Instalacion': 'TEMPERATURA INSTALACION',
    'Otros Instalacion': 'OTROS INSTALACION',
    // Sección 7
    'Rango de Voltaje': 'RANGO DE VOLTAJE',
    'Rango de Corriente': 'RANGO DE CORRIENTE',
    'Rango de Potencia': 'RANGO DE POTENCIA',
    'Frecuencia Funcionamiento': 'FRECUENCIA FUNCIONAMIENTO',
    'Rango de Presion': 'RANGO DE PRESION',
    'Rango de Velocidad': 'RANGO DE VELOCIDAD',
    'Rango de Temperatura': 'RANGO DE TEMPERATURA',
    'Peso Funcionamiento': 'PESO FUNCIONAMIENTO',
    'Rango de Humedad': 'RANGO DE HUMEDAD',
    'Otras Recomendaciones del Fabricante': 'OTRAS RECOMENDACIONES DEL FABRICANTE',
  };

  openModal('newInventario');
  const form = document.getElementById('inventarioForm');
  if (!form) return;

  // Resetear formulario primero
  form.reset();

  // Mostrar indicador de carga
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Cargando datos...'; }

  try {
    // Fetch del registro completo desde Airtable (con todos los campos)
    const res = await fetch(`${API_BASE_URL}/inventario?id=${recordId}`, { headers: getAuthHeader() });
    const data = await res.json();
    if (!data.ok || !data.record) {
      alert('No se pudo cargar el registro para editar.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar equipo'; }
      return;
    }

    const fields = data.record.fields || {};
    console.log('📋 Campos del registro para editar:', fields);

    // Construir un mapa con TODAS las claves posibles: nombre Airtable Y nombre HTML
    const formValues = {};
    for (const [atKey, val] of Object.entries(fields)) {
      // Guardar con nombre Airtable
      formValues[atKey] = val;
      // Guardar con nombre HTML (del REVERSE_MAP)
      if (REVERSE_MAP[atKey]) {
        formValues[REVERSE_MAP[atKey]] = val;
      }
    }

    // Llenar cada input/select/textarea del formulario
    form.querySelectorAll('input, select, textarea').forEach(input => {
      if (!input.name) return;
      if (input.type === 'file') return; // No se puede setear archivos
      const val = formValues[input.name] ?? formValues[input.name.toUpperCase()] ?? '';
      if (input.type === 'checkbox') {
        input.checked = val === true || val === 'true' || val === 'SI' || val === 'Si';
      } else if (input.tagName === 'SELECT') {
        // Para selects, buscar la opción que coincida (fuzzy)
        const strVal = String(val || '');
        let matched = false;
        for (const opt of input.options) {
          if (opt.value === strVal || opt.value.toLowerCase() === strVal.toLowerCase()
              || opt.textContent.trim().toLowerCase() === strVal.toLowerCase()) {
            input.value = opt.value;
            matched = true;
            break;
          }
        }
        if (!matched && strVal) {
          console.warn(`⚠️ Select "${input.name}": valor "${strVal}" no encontrado entre opciones`);
        }
      } else {
        input.value = val != null ? String(val) : '';
      }
    });

    // Manejar el campo Calibrable (tiene UI especial con dos selects)
    const calibrableVal = fields['Calibrable'] || '';
    const calIdent = document.getElementById('calibrableIdentSelect');
    const calMain = document.getElementById('calibrableMainSelect');
    if (calIdent && calibrableVal) calIdent.value = calibrableVal;
    if (calMain && calibrableVal) calMain.value = calibrableVal;

    _invState.currentEditId = recordId;
    console.log('✅ Formulario cargado para edición del registro:', recordId);

  } catch (err) {
    console.error('❌ Error cargando registro para editar:', err);
    alert('Error al cargar los datos del equipo: ' + err.message);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = _invState.currentEditId ? 'Actualizar equipo' : 'Guardar equipo'; }
  }
}

async function deleteEquipo(recordId, equipoName) {
  if (!confirm(`¿Eliminar "${equipoName}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/inventario?id=${recordId}`, {
      method: 'DELETE', headers: getAuthHeader()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _invState.currentOffset = null;
    _invState.currentPage = 0;
    await loadInventario();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
}

function exportInventarioCSV() {
  if (!_invState.allRecords.length) { alert('No hay datos para exportar'); return; }
  const headers = ['Item','Equipo','Marca','Modelo','Serie','Numero de Placa','Servicio','Ubicacion','Vida Util','Fecha Programada de Mantenimiento'];
  const rows = [headers.join(',')];
  _invState.allRecords.forEach(r => {
    const f = r.fields || {};
    const row = headers.map(h => { const v = String(f[h] || '').replace(/"/g,'""'); return v.includes(',') ? `"${v}"` : v; });
    rows.push(row.join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ============================================================================
// UTILIDAD
// ============================================================================

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ============================================================================
// CERTIFICADOS DE CALIBRACIÓN (UI + Base64)
// ============================================================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const res = String(reader.result || '');
      // reader.result = data:application/pdf;base64,AAAA...
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.readAsDataURL(file);
  });
}


// ==============================================================
// CALIBRABLE: mostrar/ocultar seccion de certificados PDF
// ==============================================================
function toggleCalCertSection() {
  var identSelect = document.getElementById('calibrableIdentSelect');
  var section = document.getElementById('calCertSection');
  if (!identSelect || !section) return;
  var esSI = identSelect.value === 'SI';
  section.style.display = esSI ? '' : 'none';
  var mainSelect = document.getElementById('calibrableMainSelect');
  if (mainSelect && identSelect.value !== '') mainSelect.value = identSelect.value;
  if (!esSI) {
    var list = document.getElementById('calCertList');
    if (list) {
      var inp = list.querySelectorAll('input[name="CAL_CERT_FILE"]');
      for (var i = 0; i < inp.length; i++) inp[i].value = '';
    }
  }
}

function syncCalibrableSelects(origin) {
  if (origin === 'main') {
    var m = document.getElementById('calibrableMainSelect');
    var id = document.getElementById('calibrableIdentSelect');
    if (m && id) { id.value = m.value; toggleCalCertSection(); }
  }
}

window.toggleCalCertSection = toggleCalCertSection;

// ── CÁLCULO AUTOMÁTICO FECHA PRÓXIMA CALIBRACIÓN (fijo: +12 meses) ─────────
window.calcProximaCalibracion = function() {
  var fechaInput   = document.getElementById('invFechaCalibracion');
  var proximaInput = document.getElementById('invFechaProximaCal');
  var infoEl       = document.getElementById('invProximaCalInfo');
  if (!fechaInput || !proximaInput) return;

  var fechaVal = fechaInput.value; // YYYY-MM-DD
  if (!fechaVal) {
    proximaInput.value = '';
    proximaInput.style.borderColor = '';
    if (infoEl) infoEl.textContent = 'Se calcula automáticamente sumando 12 meses a la fecha de calibración.';
    return;
  }

  var d = new Date(fechaVal + 'T00:00:00');
  if (isNaN(d.getTime())) return;

  // Siempre +12 meses
  d.setMonth(d.getMonth() + 12);
  var yyyy = d.getFullYear();
  var mm   = String(d.getMonth() + 1).padStart(2, '0');
  var dd   = String(d.getDate()).padStart(2, '0');
  proximaInput.value = yyyy + '-' + mm + '-' + dd;

  // Estado visual según días restantes
  var hoy  = new Date(); hoy.setHours(0,0,0,0);
  var diff = Math.round((d - hoy) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    proximaInput.style.borderColor = '#c62828';
    proximaInput.style.background  = '#fce4ec';
    proximaInput.style.color       = '#c62828';
    if (infoEl) infoEl.innerHTML = '<span style="color:#c62828;font-weight:700">⚠️ Calibración VENCIDA hace ' + Math.abs(diff) + ' días</span>';
  } else if (diff <= 60) {
    proximaInput.style.borderColor = '#f57f17';
    proximaInput.style.background  = '#fff8e1';
    proximaInput.style.color       = '#e65100';
    if (infoEl) infoEl.innerHTML = '<span style="color:#f57f17;font-weight:700">⏰ Próxima calibración en ' + diff + ' días</span>';
  } else {
    proximaInput.style.borderColor = '#2e7d32';
    proximaInput.style.background  = '#f3e5f5';
    proximaInput.style.color       = '#4a148c';
    if (infoEl) infoEl.innerHTML = '<span style="color:#2e7d32">✅ Vigente · próxima calibración en ' + diff + ' días</span>';
  }
};
window.syncCalibrableSelects = syncCalibrableSelects;

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMACIÓN DE MANTENIMIENTO: elige mes + semana para cada periodo
// ─────────────────────────────────────────────────────────────────────────────
var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var FREQ_COUNT = { Mensual:12, Bimestral:6, Trimestral:4, Cuatrimestral:3, Semestral:2, Anual:1 };
var FREQ_WINDOWS = {
  Mensual:      [[0],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11]],
  Bimestral:    [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11]],
  Trimestral:   [[0,1,2],[3,4,5],[6,7,8],[9,10,11]],
  Cuatrimestral:[[0,1,2,3],[4,5,6,7],[8,9,10,11]],
  Semestral:    [[0,1,2,3,4,5],[6,7,8,9,10,11]],
  Anual:        [[0,1,2,3,4,5,6,7,8,9,10,11]]
};
var _mttoSlots = [];

function onFreqChange() {
  var sel = document.getElementById('invFreqSelect');
  var grp = document.getElementById('scheduleBuilderGroup');
  if (!sel || !grp) return;
  if (!sel.value) { grp.style.display = 'none'; return; }
  var freq = sel.value;
  var count = FREQ_COUNT[freq] || 1;
  _mttoSlots = [];
  for (var i = 0; i < count; i++) _mttoSlots.push({ mes: null, sem: null });
  grp.style.display = '';
  buildSlotGrid(freq);
  updateMttoTextarea();
}

function buildSlotGrid(freq) {
  var container = document.getElementById('scheduleMonthGrid');
  if (!container) return;
  container.innerHTML = '';
  var windows = FREQ_WINDOWS[freq] || [[0,1,2,3,4,5,6,7,8,9,10,11]];
  _mttoSlots.forEach(function(slot, idx) {
    var win = windows[idx] || windows[0];
    var card = document.createElement('div');
    card.style.cssText = 'padding:10px 14px; background:#f4f7ff; border-radius:10px; border:1px solid #dbe4ff; display:flex; flex-direction:column; gap:8px;';

    var header = document.createElement('div');
    header.style.cssText = 'font-weight:700; font-size:0.83em; color:#2563eb; text-transform:uppercase; letter-spacing:0.04em;';
    header.textContent = 'Periodo ' + (idx+1) + ' · ' + (win.length > 1 ? MESES[win[0]].slice(0,3) + '–' + MESES[win[win.length-1]].slice(0,3) : MESES[win[0]]);
    card.appendChild(header);

    var mesRow = document.createElement('div');
    mesRow.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';
    var mesLbl = document.createElement('span');
    mesLbl.textContent = 'Mes:';
    mesLbl.style.cssText = 'font-size:0.83em; font-weight:600; color:#555; white-space:nowrap; min-width:42px;';
    mesRow.appendChild(mesLbl);
    win.forEach(function(mi) {
      var mb = document.createElement('button');
      mb.type = 'button';
      mb.textContent = MESES[mi].slice(0,3);
      mb.dataset.slot = idx; mb.dataset.mes = mi;
      mb.style.cssText = 'padding:4px 9px; border-radius:5px; border:1.5px solid #b0bec5; font-size:0.8em; cursor:pointer; background:#fff; font-weight:600; transition:all 0.15s;';
      if (_mttoSlots[idx].mes === mi) applyMttoActive(mb, true);
      mb.onclick = function() { selectMesForSlot(idx, mi, card); };
      mesRow.appendChild(mb);
    });
    card.appendChild(mesRow);

    var semRow = document.createElement('div');
    semRow.id = 'semRow_' + idx;
    semRow.style.cssText = 'display:' + (_mttoSlots[idx].mes !== null ? 'flex' : 'none') + '; align-items:center; gap:8px; flex-wrap:wrap;';
    var semLbl = document.createElement('span');
    semLbl.textContent = 'Semana:';
    semLbl.style.cssText = 'font-size:0.83em; font-weight:600; color:#555; white-space:nowrap; min-width:62px;';
    semRow.appendChild(semLbl);
    ['S1','S2','S3','S4'].forEach(function(s, si) {
      var sb = document.createElement('button');
      sb.type = 'button';
      sb.dataset.slot = idx; sb.dataset.sem = s;
      var mesActual = _mttoSlots[idx].mes;
      sb.textContent = s + (mesActual !== null ? ' (' + getWeekDatesOfMonth(mesActual, si) + ')' : '');
      sb.style.cssText = 'padding:4px 10px; border-radius:5px; border:1.5px solid #b0bec5; font-size:0.8em; cursor:pointer; background:#fff; font-weight:600; transition:all 0.15s; white-space:nowrap;';
      if (_mttoSlots[idx].sem === s) applyMttoActive(sb, true);
      sb.onclick = function() { selectSemForSlot(idx, s, semRow); };
      semRow.appendChild(sb);
    });
    card.appendChild(semRow);
    container.appendChild(card);
  });
}

function applyMttoActive(btn, active) {
  if (active) { btn.style.background='#2563eb'; btn.style.color='#fff'; btn.style.borderColor='#2563eb'; }
  else { btn.style.background='#fff'; btn.style.color=''; btn.style.borderColor='#b0bec5'; }
}

function selectMesForSlot(slotIdx, mesIdx, card) {
  _mttoSlots[slotIdx].mes = mesIdx;
  _mttoSlots[slotIdx].sem = null;
  card.querySelectorAll('button[data-mes]').forEach(function(b) { applyMttoActive(b, +b.dataset.mes === mesIdx); });
  var semRow = document.getElementById('semRow_' + slotIdx);
  if (semRow) {
    semRow.style.display = 'flex';
    semRow.querySelectorAll('button[data-sem]').forEach(function(sb, si) {
      sb.textContent = sb.dataset.sem + ' (' + getWeekDatesOfMonth(mesIdx, si) + ')';
      applyMttoActive(sb, false);
    });
  }
  updateMttoTextarea();
}

function selectSemForSlot(slotIdx, sem, semRow) {
  _mttoSlots[slotIdx].sem = sem;
  semRow.querySelectorAll('button[data-sem]').forEach(function(b) { applyMttoActive(b, b.dataset.sem === sem); });
  updateMttoTextarea();
}

function getWeekDatesOfMonth(monthIndex, weekIndex) {
  var year = new Date().getFullYear();
  var firstDay = new Date(year, monthIndex, 1);
  var dayOfWeek = firstDay.getDay() || 7;
  var offset = dayOfWeek === 1 ? 0 : (8 - dayOfWeek);
  var weekStart = new Date(year, monthIndex, 1 + offset + weekIndex * 7);
  var weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  return weekStart.getDate() + '/' + (weekStart.getMonth()+1) + '–' + weekEnd.getDate() + '/' + (weekEnd.getMonth()+1);
}

function updateMttoTextarea() {
  var ta = document.getElementById('invScheduleAnnual');
  if (!ta) return;
  var year = new Date().getFullYear();
  var parts = _mttoSlots.map(function(slot, i) {
    if (slot.mes === null) return 'P' + (i+1) + ': pendiente';
    if (!slot.sem) return MESES[slot.mes] + ': semana pendiente';
    var wn = +slot.sem.replace('S','');
    return MESES[slot.mes] + ' ' + slot.sem + ' (' + getWeekDatesOfMonth(slot.mes, wn-1) + '/' + year + ')';
  });
  ta.value = parts.join(' | ');
}

function clearMttoSchedule() {
  _mttoSlots = [];
  var sel = document.getElementById('invFreqSelect');
  if (sel) sel.value = '';
  var grp = document.getElementById('scheduleBuilderGroup');
  if (grp) grp.style.display = 'none';
  var ta = document.getElementById('invScheduleAnnual');
  if (ta) ta.value = '';
}

function clearManualFile() {
  var mi = document.getElementById('manualFileInput');
  if (mi) mi.value = '';
}

function generateAnnualSchedule() {}
function clearAnnualSchedule() { clearMttoSchedule(); }

window.onFreqChange = onFreqChange;
window.clearMttoSchedule = clearMttoSchedule;
window.clearManualFile = clearManualFile;
window.generateAnnualSchedule = generateAnnualSchedule;
window.clearAnnualSchedule = clearAnnualSchedule;

function addCalCertRow() {
  const list = document.getElementById('calCertList');
  if (!list) return;
  const year = String(new Date().getFullYear());
  const row = document.createElement('div');
  row.className = 'cal-cert-row';
  row.innerHTML = `
    <input name="CAL_CERT_YEAR" type="number" min="2000" max="2100" step="1" placeholder="Año" value="${year}" style="max-width:140px;">
    <input name="CAL_CERT_FILE" type="file" accept="application/pdf" style="flex:1;">
    <button type="button" class="btn btn-secondary btn-small" onclick="removeCalCertRow(this)" title="Quitar">✕</button>
  `;
  list.appendChild(row);
}

function removeCalCertRow(btn) {
  try {
    const row = btn && btn.closest ? btn.closest('.cal-cert-row') : null;
    if (!row) return;
    const list = document.getElementById('calCertList');
    if (!list) return;
    // Mantener al menos una fila
    if (list.querySelectorAll('.cal-cert-row').length <= 1) {
      const yearEl = row.querySelector('input[name="CAL_CERT_YEAR"]');
      const fileEl = row.querySelector('input[name="CAL_CERT_FILE"]');
      if (yearEl) yearEl.value = String(new Date().getFullYear());
      if (fileEl) fileEl.value = '';
      return;
    }
    row.remove();
  } catch (e) {}
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Sistema de Gestión de Mantenimiento Hospitalario iniciado');

  // Dashboard init
  if (document.getElementById('dashboard')) {
    initDashboard();
  }

  // Formulario inventario (modal newInventario con campos UPPERCASE)
  const inventarioForm = document.getElementById('inventarioForm');
  if (inventarioForm) {
    // Quitar "required" de inputs dentro de <details> para evitar error "not focusable"
    // La validación se hace en JS (submitInventarioForm)
    inventarioForm.querySelectorAll('details input[required], details select[required], details textarea[required]').forEach(el => {
      el.removeAttribute('required');
      el.dataset.jsRequired = 'true'; // marcamos para validar por JS
    });

    inventarioForm.addEventListener('submit', submitInventarioForm);
  }

  // Refresh dashboard cada 5 min
  setInterval(() => {
    const active = document.querySelector('.module.active');
    if (active && active.id === 'dashboard') fetchDashboardData();
  }, 300000);
});

// Exponer funciones al window para onclick=""
window.switchModule = switchModule;
window.openModal = openModal;
window.closeModal = closeModal;
window.loadInventario = loadInventario;
window.debouncedInventarioSearch = debouncedInventarioSearch;
window.inventarioNextPage = inventarioNextPage;
window.inventarioPrevPage = inventarioPrevPage;
window.exportInventarioCSV = exportInventarioCSV;
window.editEquipo = editEquipo;
window.deleteEquipo = deleteEquipo;
window.addCalCertRow = addCalCertRow;
window.removeCalCertRow = removeCalCertRow;
