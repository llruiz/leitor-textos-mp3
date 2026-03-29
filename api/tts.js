// /api/tts.js - Serverless Function para Vercel
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// Configuração do cliente Google Cloud
// As credenciais vêm da variável de ambiente GOOGLE_CREDENTIALS_JSON
let client = null;

function getClient() {
  if (!client) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    client = new TextToSpeechClient({ credentials });
  }
  return client;
}

module.exports = async (req, res) => {
  // CORS - permitir acesso de qualquer origem (ou restrinja ao seu domínio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { text, voice = 'pt-BR-Standard-A' } = req.body;
    
    // Validações
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto é obrigatório' });
    }
    
    if (text.length > 5000) {
      return res.status(400).json({ 
        error: 'Texto muito longo. Máximo 5000 caracteres por requisição.',
        received: text.length 
      });
    }
    
    // Configuração da voz
    const voiceConfig = {
      languageCode: 'pt-BR',
      name: voice,
      ssmlGender: voice.includes('A') ? 'FEMALE' : 'MALE'
    };
    
    // Configuração do áudio
    const audioConfig = {
      audioEncoding: 'MP3',
      speakingRate: 1.0,  // Velocidade normal (0.25 a 4.0)
      pitch: 0.0,           // Tom normal (-20.0 a 20.0)
      volumeGainDb: 0.0,    // Volume normal (-96.0 a 16.0)
      sampleRateHertz: 24000
    };

    // Chamada à API Google Cloud
    const ttsClient = getClient();
    const request = {
      input: { text },
      voice: voiceConfig,
      audioConfig: audioConfig
    };

    console.log(`Gerando áudio: ${text.length} caracteres, voz: ${voice}`);
    const [response] = await ttsClient.synthesizeSpeech(request);
    
    // Retornar o áudio como MP3
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', response.audioContent.length);
    res.send(response.audioContent);
    
    console.log(`Áudio gerado: ${response.audioContent.length} bytes`);

  } catch (error) {
    console.error('Erro TTS:', error);
    
    // Tratamento específico de erros
    if (error.code === 8 || error.message.includes('quota')) {
      return res.status(429).json({ 
        error: 'Cota do Google Cloud excedida. Tente novamente mais tarde ou verifique o billing.',
        details: error.message
      });
    }
    
    if (error.message.includes('credentials') || error.message.includes('GOOGLE')) {
      return res.status(500).json({ 
        error: 'Erro de configuração das credenciais Google Cloud.',
        details: 'Verifique se a variável GOOGLE_CREDENTIALS_JSON está configurada corretamente.'
      });
    }
    
    res.status(500).json({ 
      error: 'Erro ao gerar áudio',
      details: error.message 
    });
  }
};
