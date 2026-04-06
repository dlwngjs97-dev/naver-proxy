const express = require('express')
const axios = require('axios')
const app = express()

app.use(express.json({ limit: '50mb' }))

const SECRET = process.env.PROXY_SECRET
const NAVER = 'https://api.commerce.naver.com'

// 시크릿 검증
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  if (req.headers['x-proxy-secret'] !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

// 헬스체크
app.get('/health', (_, res) => res.json({ ok: true }))

// 이미지 업로드 (multipart는 별도 처리)
app.post('/upload-image', async (req, res) => {
  try {
    const { imageBase64, contentType, filename, naverToken } = req.body
    const imgBuffer = Buffer.from(imageBase64, 'base64')

    const FormData = require('form-data')
    const form = new FormData()
    form.append('imageFiles', imgBuffer, { filename, contentType })

    const response = await axios.post(
      `${NAVER}/external/v1/product-images/upload`,
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${naverToken}` } }
    )
    res.json(response.data)
  } catch (err) {
    const detail = err.response?.data ?? err.message
    res.status(err.response?.status ?? 500).json({ error: detail })
  }
})

// 나머지 Naver API 요청 포워딩
app.all('/naver/*', async (req, res) => {
  const path = req.path.replace('/naver', '')
  const targetUrl = NAVER + path

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: 'api.commerce.naver.com',
        'x-proxy-secret': undefined,
      },
      data: req.body,
      params: req.query,
      validateStatus: () => true,
    })
    res.status(response.status).json(response.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Naver proxy running on :${PORT}`))
