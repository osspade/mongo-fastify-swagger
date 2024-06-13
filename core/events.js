import common from './common.js'
export default class events{

constructor(){
}

 route(util){
   const _collection = this.constructor.name
   const collection = util.db.collection(_collection)
   new common(util, this.constructor.name)

  util.fastify.route({
    method: 'GET',
    url: `/${_collection}`,
    schema: {
      tags: [_collection],
      description: `${_collection} Info`,
      security: [{ apiauth: [] }],
    },
    preHandler: util.fastify.auth([util.fastify.authenticate]),
    handler: async function (request, reply) {

      reply.status(200).send(await collection.find({email: {"$eq":null,"$exists":false} }).toArray());

    }
  })

  util.fastify.route({
    method: 'GET',
    url: `/${_collection}/email`,
    schema: {
      tags: [_collection],
      description: `${_collection} Email Filter`,
      security: [{ apiauth: [] }],
    },
    preHandler: util.fastify.auth([util.fastify.authenticate]),
    handler: async function (request, reply) {

      
      reply.status(200).send(await collection.find({email:true}).toArray());

    }
  })


util.fastify.route({
  method: 'GET',
  url: `/${_collection}/email-preview/:id`,
  schema: {
    tags: [_collection],
    description: `${_collection} Email Filter`,
    security: [{ apiauth: [] }],
  },
  preHandler: util.fastify.auth([util.fastify.authenticate]),
  handler: async function (request, reply) {
const {id} = request.params
   const event =  await collection.findOne({_id : new util.fastify.mongo.ObjectId(id)})
    let mail = {
      to: event.details.email,
      subject: await util.fastify.view(event.details.subject, event.details),
      html: await util.fastify.view(event.details.message, event.details)
    }
    
    reply.status(200).send(mail);

  }
})


 }

  async log(util, details) {

    const collection = util.db.collection(this.constructor.name)
    const schema = {
      'details': details,
      'created': new Date(),
    }
    util.fastify.log.info(schema)

    return await collection.insertOne(schema);
  }

  async email(util, details) {

    const collection = util.db.collection(this.constructor.name)

    const schema = {
      'details': details,
      'email': true,
      'log': [{ 'status': "pending", 'updated': new Date() }],
      'created': new Date()
    }
    util.fastify.log.info(schema)

    return await collection.insertOne(schema);
  }


  async notification(util, details) {

    const collection = util.db.collection(this.constructor.name)

    const schema = {
      'details': details,
      'notification': true,
      'log': [{ 'status': "pending", 'updated': new Date() }],
      'created': new Date()
    }
    util.fastify.log.info(schema)
   
    // < -- MQTT Publish -- >
    
    return await collection.insertOne(schema);
  }

  





}
