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
      description: `Retrieve all ${_collection} that don't have an email property`,
      security: [{ apiauth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', description: 'Unique identifier' },
              details: { type: 'object', description: 'Event details' },
              created: { type: 'string', format: 'date-time', description: 'Creation timestamp' }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
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
      description: `Retrieve all ${_collection} that have the email flag set to true`,
      security: [{ apiauth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', description: 'Unique identifier' },
              details: { type: 'object', description: 'Event details with email information' },
              email: { type: 'boolean', description: 'Email flag (true)' },
              log: { 
                type: 'array', 
                items: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', description: 'Current status of the email event' },
                    updated: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
                  }
                }
              },
              created: { type: 'string', format: 'date-time', description: 'Creation timestamp' }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
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
    description: `Get a preview of an email for a specific ${_collection} record`,
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Unique identifier of the event' }
      }
    },
    security: [{ apiauth: [] }],
    response: {
      200: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Email recipient' },
          subject: { type: 'string', description: 'Email subject with variables rendered' },
          html: { type: 'string', description: 'Email body content with variables rendered' }
        }
      },
      401: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer' },
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      404: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer' },
          error: { type: 'string' },
          message: { type: 'string', description: 'Event not found' }
        }
      }
    }
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
