import fastifyUtil from './fastify-util.js'; 
import Feature from './feature/index.js';
new fastifyUtil().then( async(util)=>{
  
// Example Feature
new Feature(util)


try {
  await util.fastify.listen({ port: 5000, host: '0.0.0.0'  })
} catch (err) {
  util.fastify.log.error(err)
  process.exit(1)
}
} )