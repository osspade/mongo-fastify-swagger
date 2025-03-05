import dotenv from 'dotenv';
import FastifyUtil from './fastify-util';

dotenv.config();

async function start() {
  try {
    const util = await new FastifyUtil();
    const address = await util.fastify.listen({ port: 5000, host: '0.0.0.0' });
    console.log(`Server listening at ${address}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start(); 