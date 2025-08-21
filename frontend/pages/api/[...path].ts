import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query;
  const url = `${BACKEND_URL}/api/${Array.isArray(path) ? path.join('/') : path}`;

  try {
    const response = await axios({
      method: req.method,
      url,
      headers: {
        ...req.headers,
        host: undefined, // 移除 host header
      },
      data: req.body,
    });

    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

// 禁用 body parsing，让我们自己处理
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
