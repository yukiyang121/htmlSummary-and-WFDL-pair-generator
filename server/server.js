//works, missing API key
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

app.post('/generate-summary', async (req, res) => {
  try {
    // return res.status(400).json(req);

    const base64Image = req.body.base64Image;
    if (!base64Image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const result = await model.generateContent([
      { text: 'Describe this UI section in plain English for a training data pair' },
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Image.split(',')[1], // remove data:image/png;base64,
        },
      },
    ]);

    const text = result.response.text();
    res.json({ summary: text });

  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'Gemini call failed', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`Gemini server running at http://localhost:${port}`);
});

