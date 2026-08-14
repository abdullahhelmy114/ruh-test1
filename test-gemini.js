const API_KEY = "AQ.Ab8RN6Lg3XtH64bCo7ucMjfKUEZiQBO40PZECGV_Ej_57365mg"; // ضع مفتاحك

async function listModels() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
  );
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

listModels();