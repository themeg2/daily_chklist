import { createClient } from 'redis';

// Redis 클라이언트 생성
const getRedisClient = async () => {
  const client = createClient({
    url: process.env.REDIS_URL
  });
  
  if (!client.isOpen) {
    await client.connect();
  }
  
  return client;
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const client = await getRedisClient();
      const data = await client.get('schedules');
      await client.quit();
      
      const schedules = data ? JSON.parse(data) : [];
      return res.status(200).json(schedules);
    } catch (error) {
      console.error('Redis GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch data' });
    }
  } 
  else if (req.method === 'POST') {
    try {
      const schedules = req.body;
      const client = await getRedisClient();
      await client.set('schedules', JSON.stringify(schedules));
      await client.quit();
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Redis SET error:', error);
      return res.status(500).json({ error: 'Failed to save data' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
