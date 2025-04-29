import { events, service, common } from './index.js'

export default class form {

  constructor(util) {

    this.routes(util, this.constructor.name)
    new common(util, this.constructor.name)
    new service().populateform(util, this.constructor.name)
  }

  routes(util, _collection) {

    const collection = util.db.collection(_collection);
  
    util.fastify.route({
      method: 'GET',
      url: `/${_collection}`,
      schema: {
        tags: [_collection],
        description: `Retrieve all ${_collection} records`,
        security: [{ apiauth: [] }],
        response: {
          401: {
            type: 'object',
            description: 'Authentication error',
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

        new events().log(util, {
          'url': `/${_collection}`,
          'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
        })

        reply.status(200).send(await collection.find({}).toArray());
      }
    })

    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/update/:id`,
      schema: {
        tags: [_collection],
        description: `Update an existing ${_collection} by ID`,
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Unique identifier of the form to update' }
          }
        },
        body: {
          type: 'object',
          required: ["title", "data"],
          properties: {
            title: { 
              type: 'string', 
              description: 'The title of the form' 
            },
            data: { 
              type: 'object', 
              description: 'Form structure and fields definition',
              properties: {} 
            }
          }
        },
        security: [{ apiauth: [] }],
        response: {
          400: {
            type: 'object',
            description: 'Update error',
            properties: {
              error: { type: 'string', description: 'Error details' }
            }
          },
          401: {
            type: 'object',
            description: 'Authentication error',
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

        let { id } = request.params
        try {
          collection.updateOne(
            { "_id": new util.fastify.mongo.ObjectId(id) },
            { $set: request.body },
            { upsert: true }
          )

          let result = { "form$form": { _id: new util.fastify.mongo.ObjectId(id) }, "form.update": Object.keys(request.body) }
          let eventPayload = {
            'url': `/${_collection}/update/${id}`,
            'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
            ...result
          }

          new events().log(util, eventPayload)

          reply.status(200).send(result);

        } catch (e) {
          reply.status(400).send({ "error": e });
        }

      }
    })

    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/response/:id`,
      schema: {
        tags: [_collection],
        description: `Submit responses to a specific ${_collection}`,
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Unique identifier of the form to respond to' }
          }
        },
        body: {
          type: 'object',
          required: ["response"],
          properties: {
            response: { 
              type: 'object', 
              description: 'Form response data containing answers to form fields' 
            }
          }
        },
        security: [{ apiauth: [] }],
        response: {
          400: {
            type: 'object',
            description: 'Submission error',
            properties: {
              error: { type: 'string', description: 'Error details' }
            }
          },
          401: {
            type: 'object',
            description: 'Authentication error',
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
        let { id } = request.params

        try {

          await collection.updateOne(
            { "_id": new util.fastify.mongo.ObjectId(id) },
            { '$push': { 'response': request.body.response } },
            { 'upsert': true }
          )


          let eventPayload = {
            'url': `/${_collection}/response/${id}`,
            'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
            ...request.body
          }

          new events().log(util, eventPayload)

          reply.status(200).send(request.body);

        } catch (e) {
          reply.status(400).send({ "error": e });
        }


      }
    })

    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/create`,
      schema: {
        tags: [_collection],
        description: `Create a new ${_collection}`,
        body: {
          type: 'object',
          required: ["title", "data"],
          properties: {
            title: { 
              type: 'string', 
              description: 'The title of the form',
              default: "My New Form" 
            },
            data: { 
              type: 'object', 
              description: 'Form structure and fields definition',
              properties: {} 
            }
          }
        },
        security: [{ apiauth: [] }],
        response: {
          400: {
            type: 'object',
            description: 'Creation error',
            properties: {
              error: { type: 'string', description: 'Error details' }
            }
          },
          401: {
            type: 'object',
            description: 'Authentication error',
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

        let createSchema = { response: [], ...request.body };


        try {

          let result = await collection.insertOne(createSchema)
          let eventPayload = {
            'url': `/${_collection}/create/`,
            'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
            ...result
          }

          new events().log(util, eventPayload)

          reply.status(200).send(result);

        } catch (e) {
          reply.status(400).send({ "error": e });
        }

      }
    })
  }



}
