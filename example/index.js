import fastifyUtil from './fastify-util.js'; 
let backend;
try{
  backend = await import("../core/index.js");
}catch(e){
  console.log("core",e)
  try{
    backend = await import("backend-api");
}catch(e){
  console.log("backend-api",e)
}  
}
const { account,form, upload,wipay,product,order,events } = backend
//Feature
import feature from './feature/index.js';
//Util
new fastifyUtil().then( async(util)=>{
  
//services 
new account(util);
new form(util)
new upload(util)
new wipay(util)
new product(util)
new order(util)
new events()?.route(util)

//Feature
new feature(util)


try {
  await util.fastify.listen({ port: 5000, host: '0.0.0.0'  })
} catch (err) {
  util.fastify.log.error(err)
  process.exit(1)
}
} )