import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('WARNING: GEMINI_API_KEY environment variable is not defined.');
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Robust function with progressive backoff and fallback models
  async function generateContentWithRetryAndFallback(params: any) {
    const modelsToTry = [params.model, 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      if (!modelName) continue;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[AI Info] Attempting to invoke model "${modelName}" (Attempt ${attempt}/3)...`);
          const response = await ai.models.generateContent({
            ...params,
            model: modelName,
          });
          console.log(`[AI Success] Successfully completed generation with model "${modelName}".`);
          return response;
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Warning] Model "${modelName}" failed on attempt ${attempt}: ${err.message || err}`);
          
          // Wait progressive delay unless it is the last attempt
          if (attempt < 3) {
            const delayMs = attempt * 800;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }
      console.warn(`[AI Warning] Model "${modelName}" exhausted. Dropping back to next fallback option if available.`);
    }
    
    throw lastError || new Error('All model attempts and fallbacks failed to respond.');
  }

  // Endpoints
  // Analyze text for grammar, spelling, punctuation, clarity, and readability
  app.post('/api/analyze', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || text.trim() === '') {
        return res.json({
          issues: [],
          readability: { score: 'N/A', summary: 'Please enter some text to analyze.' },
          suggestions: [],
          stats: { words: 0, characters: 0, readingTime: '0 min' }
        });
      }

      const prompt = `You are an elite, highly precise writing coach and editor.
Analyze the following text to identify grammar mistakes, spelling errors, punctuation mistakes, vocabulary recommendations, and clarity issues.
For every single mistake or improvement found, you MUST return:
1. "original": The EXACT substring from the input text that has the issue. It must be an exact literal match of characters in the original text (including case, spaces, and punctuation) so we can replace it programmatically.
2. "suggestion": The corrected, polished, or improved string to replace it.
3. "type": One of 'grammar', 'spelling', 'punctuation', 'clarity', 'vocabulary'.
4. "explanation": A concise, friendly explanation of why the change is helpful.

Also, complete the following analysis:
1. "readability": { "score": "A school/grade index, or overall index (e.g. 'Easy to Read', '8th Grade Level', 'Hard to Read', 'Academic')", "summary": "A 1-2 sentence assessment of the readability and style." }
2. "suggestions": A few high-level general sentences/tips on formatting, structural balance, or tone context.

Analyze this text immediately:
"""
${text}
"""`;

      const response = await generateContentWithRetryAndFallback({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                    type: { type: Type.STRING, description: "Must be 'grammar', 'spelling', 'punctuation', 'clarity', or 'vocabulary'" },
                    explanation: { type: Type.STRING }
                  },
                  required: ["original", "suggestion", "type", "explanation"]
                }
              },
              readability: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.STRING },
                  summary: { type: Type.STRING }
                },
                required: ["score", "summary"]
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["issues", "readability", "suggestions"]
          }
        }
      });

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('Error analyzing text:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze text' });
    }
  });

  // Rewrite standard text based on selected modes / tones
  app.post('/api/rewrite', async (req, res) => {
    try {
      const { text, mode, tone } = req.body;
      if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Text is required for rewriting.' });
      }

      let instruction = "You are a professional editor and creative writer. Rewrite the provided text as instructed below. Keep unchanged parts of the text coherent and polished.";
      if (mode === 'shorter') {
        instruction += " Make the text significantly shorter and more concise, removing excess wordiness while preserving the vital core message.";
      } else if (mode === 'longer') {
        instruction += " Expand the text slightly, adding rich description, natural depth, or supportive phrasing to make it more comprehensive.";
      } else if (mode === 'simpler') {
        instruction += " Simplify the sentence structures and vocabulary so that it is extremely easy to read, clear, and direct.";
      } else if (mode === 'engaging') {
        instruction += " Make the text dynamic, lively, and engaging to read. Use active voice and compelling word choices.";
      } else if (mode === 'enhancement') {
        instruction += " Improve the sentence structures, overall flow, and grammar. Polish it for high-quality balance.";
      } else if (mode === 'vocabulary') {
        instruction += " Elevate the vocabulary. Replace common, plain words with rich, precise, and sophisticated alternatives appropriate for professional copy.";
      }

      if (tone && tone !== 'none') {
        instruction += ` Adapt the tone of the entire text to sound distinctly "${tone}".`;
      }

      const prompt = `${instruction}

Original Text:
"""
${text}
"""

Provide the fully rewritten result and a short, friendly summary of what edits were made in JSON.`;

      const response = await generateContentWithRetryAndFallback({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rewritten: { type: Type.STRING },
              explanation: { type: Type.STRING, description: "A friendly, micro explanation of the tone/style change." }
            },
            required: ["rewritten", "explanation"]
          }
        }
      });

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('Error rewriting text:', error);
      res.status(500).json({ error: error.message || 'Failed to rewrite text' });
    }
  });

  // AI Autocomplete next words of the current text
  app.post('/api/autocomplete', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || text.trim() === '') {
        return res.json({ suggestion: '' });
      }

      const prompt = `You are an AI writing companion. See the text written below and generate the natural, contextual continuation.
Generate only 3 to 10 words that would follow the very end of the text. Do not repeat any text from the input. Keep it incredibly fluent.

Current Text Context:
"""
${text}
"""`;

      const response = await generateContentWithRetryAndFallback({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestion: { type: Type.STRING, description: "The direct completion text to append starting right at the end of the input text." }
            },
            required: ["suggestion"]
          }
        }
      });

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('Error with autocomplete:', error);
      res.status(500).json({ error: error.message || 'Failed to get autocomplete suggestions' });
    }
  });

  // Integrate Vite dev middleware or serve static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static files
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.use(express.static(path.resolve(__dirname)));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started in ${isProd ? 'production' : 'development'} mode on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Critical initialization error:', error);
  process.exit(1);
});
