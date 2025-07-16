async function callGeminiWithScreenshot(base64Image) {
  // Get Gemini API key from environment variables
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }
  
  // Remove the data:image/png;base64, prefix if it exists
  const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: "Please analyze this screenshot and provide a summary of what you see."
          },
          {
            inline_data: {
              mime_type: "image/png",
              data: imageData
            }
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API call failed: ${err}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}