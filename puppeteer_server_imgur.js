import { executablePath } from 'puppeteer';
import express from 'express';
import puppeteer from 'puppeteer';
import imgur from 'imgur';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

console.log('✅ Puppeteer default Chrome path:', executablePath());
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3040;
const DOWNLOAD_DIR = path.resolve(__dirname, 'tmp');

imgur.setCredentials();
imgur.setClientId(process.env.IMGUR_CLIENT_ID);

app.use(express.json());

app.post('/upload-image', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

  const fileName = `img_${Date.now()}.png`;
  const filePath = path.join(DOWNLOAD_DIR, fileName);

  try {
    // const browser = await puppeteer.launch({ headless: true });
    // const page = await browser.newPage();
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
      
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      );
    const response = await page.goto(imageUrl, { waitUntil: 'networkidle2' });

    if (!response || !response.ok()) {
        throw new Error('🚫 이미지 로드 실패');
      }
      
      const contentType = response.headers()['content-type'];
      console.log('🧾 Content-Type:', contentType);
      
      if (!contentType.startsWith('image/')) {
        const html = await response.text();
        console.log('🚨 응답 내용:', html.slice(0, 300)); // HTML이라면 내용 확인 가능
        throw new Error(`🚫 이미지가 아님 (Content-Type: ${contentType})`);
      }

    const buffer = await response.buffer();
    await fs.ensureDir(DOWNLOAD_DIR);
    await fs.writeFile(filePath, buffer);
    await browser.close();

    // Imgur 업로드
    const uploadResult = await imgur.uploadFile(filePath);

    // 임시 파일 삭제
    await fs.remove(filePath);

    // 결과 반환
    res.json({
      success: true,
      imgurUrl: uploadResult.data.link,
      deleteHash: uploadResult.data.deletehash,
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Imgur upload server running on http://localhost:${PORT}`);
});