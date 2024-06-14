import * as bcrypt from 'bcrypt'
import { events, service, common } from './index.js'

export default class account {


  constructor(util) {
    this.routes(util, this.constructor.name)
    new common(util, this.constructor.name)

  }

  routes(util, _collection) {

    const collection = util.db.collection(_collection);
    const template_dir = "./template"

    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/create`,
      schema: {
        tags: [_collection],
        description: 'Create Account',
        body: {
          type: 'object',
          required: ["password", "profile"],
          properties: {
            password: { type: 'string', default: "secret!" },
            roles: { type: 'array', items: { type: 'string', default: "admin" } },
            profile: {
              type: 'object',
              required: ["email", "firstname", "lastname", "phone", "language"],
              properties: {
                email: { type: 'string', default: "support+APITEST@xrstudios.com" },
                firstname: { type: 'string', default: "Bill" },
                lastname: { type: 'string', default: "Brown" },
                phone: { type: 'string', default: "+16475555555" },
                language: { type: 'string', default: "en" },
              }
            }
          }
        },
      },
      handler: async function (request, reply) {


        const auth = {
          'roles': request.body.roles,
          'password': bcrypt.hashSync(request.body.password, 10),
          'authkey': bcrypt.hashSync(request.body.email + request.body.password, 10),
        }

        delete request.body.password
        delete request.body.roles
        const profile = {
          ...request.body,
          'created': new Date(),
        }



        let result = await collection.insertOne({
          ...profile,
          ...auth
        });

        let event = {
          'url': `/${_collection}/create`,
          'account$account': { _id: result.insertedId },
          'message': `${template_dir}/${profile.language}/${_collection}/create.message.cjs`,
          'subject': `${template_dir}/${profile.language}/${_collection}/create.subject.cjs`,

        }

        new events().email(util, event)
        reply.status(200).send(profile);

      }
    })

    util.fastify.route({
      method: 'POST',
      url: `/${_collection}/login`,
      schema: {
        tags: [_collection],
        description: 'Authenticate',
        body: {
          type: 'object',
          required: ["email", "password"],
          properties: {
            email: { type: 'string', default: "support+APITEST@xrstudios.com" },
            password: { type: 'string', default: "secret!" }
          }
        }, response: {
          200: {
            description: "Account Details",
            content: {
              'application/json': {
                schema: {
            type: 'object',
            properties: {
              "_id": { type: 'string' },
              "roles": { type: 'array', items:{type:'string'} },
              "authkey": { type: 'string' },
              "profile": {
                type: 'object', properties: {
                  "email": { type: 'string' },
                  "firstname": { type: 'string' },
                  "lastname": { type: 'string' },
                  "phone": { type: 'string' },
                  "language": { type: 'string' }
                }
              }
            }}}}
          }
        }
      },
      handler: async function (request, reply) {

        return collection.findOne({ "profile.email": request.body.email }).then(result => {
          if (result && result.password && bcrypt.compareSync(request.body.password, result.password)) {

            new events().log(util, {
              'url': `/${_collection}login/`,
              'account$account': { _id: new util.fastify.mongo.ObjectId(result._id) },
              'email': request.body.email,
            })

            reply.status(200).send({ "_id": result._id, "roles": result.roles, "authkey": result.authkey, "profile": result.profile });
          } else {

            let message = { 'message': "Authentication Failed" }

            new events().log(util, {
              'url': `/${_collection}login/`,
              'email': request.body.email,
              ...message
            })
            reply.status(400).send(message);
          }

        });

      }
    })

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

        new events().log(util, {
          'url': `/${_collection}`,
          'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
        })

        reply.status(200).send(request.auth);
      }
    })

    util.fastify.route({
      method: 'GET',
      url: `/${_collection}/role/:role`,
      schema: {
        tags: [_collection],
        description: `${_collection} by Roles`,
        security: [{ apiauth: [] }],
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async function (request, reply) {
      const {role} = request.params

        new events().log(util, {
          'url': `/${_collection}/role/${role}`,
          'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
        })

        reply.status(200).send(await collection.find({roles:{ $all: [role]}},{ projection: { _id:1, profile: 1 } }).toArray());
      }
    })


    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/update`,
      schema: {
        tags: [_collection],
        description: `${_collection} Update`,
        body: {
          type: 'object',
          properties: {
            password: { type: 'string' },
            profile: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                phone: { type: 'string' },
              }
            }

          }
        },
        security: [{ apiauth: [] }],
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async function (request, reply) {

        let updateSchema = {};
        if (request.body.profile) {
          if (request.body.profile.firstname) {
            updateSchema['profile.firstname'] = request.body.profile.firstname
          }
          if (request.body.profile.lastname) {
            updateSchema['profile.lastname'] = request.body.profile.lastname
          }
          if (request.body.profile.phone) {
            updateSchema['profile.phone'] = request.body.profile.phone
          }
          if (request.body.profile.language) {
            updateSchema['profile.language'] = request.body.profile.language
          }

          if (request.body.password) {
            updateSchema['password'] = bcrypt.hashSync(request.body.password, 10);

            if (request.body.profile.email) {
              updateSchema['profile.email'] = request.body.profile.email
              updateSchema.authkey = bcrypt.hashSync(request.body.profile.email + request.body.password, 10);

            }

          }

          const account_id = new util.fastify.mongo.ObjectId(request.auth._id)

          try {
            collection.updateOne(
              { "_id": account_id },
              { $set: updateSchema },
              { upsert: false }
            )

            let result = { "_id": account_id, "update": Object.keys(updateSchema) }


            let eventPayload = {
              'url': '/auth/update/',
              'message': `${template_dir}/${request.auth.profile.language}/${_collection}/update.message.cjs`,
              'subject': `${template_dir}/${request.auth.profile.language}/${_collection}/update.subject.cjs`,
              'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
              ...result
            }

            new events().email(util, eventPayload)

            reply.status(200).send(result);

          } catch (e) {
            reply.status(400).send({ "error": e });
          }
        }

      }
    })

    util.fastify.route({
      method: 'POST',
      url: `/${_collection}/reset`,
      schema: {
        tags: [_collection],
        description: `${_collection} Reset Password`,
        body: {
          type: 'object',
          required: ["email"],

          properties: {
            email: { type: 'string' },
          }
        },
      },
      handler: async function (request, reply) {
        const schemaPayload = {
          'profile.email': request.body.email,
        }

        return collection.findOne(schemaPayload).then(async result => {
          if (result) {

            let eventPayload = {
              'url': `/${_collection}/reset`,
              'message': `${template_dir}/${result.profile.language}/${_collection}/reset.message.cjs`,
              'subject': `${template_dir}/${result.profile.language}/${_collection}/reset.subject.cjs`,
              ...result,
            }

            new events().email(util, eventPayload)

            reply.status(200).send({ "message": "Auth Reset" });

          } else {

            let message = {
              'url': '/auth/reset',
              ...schemaPayload,
              "message": "Auth Reset Failed."
            }
            new events().log(util, message)
            reply.status(400).send(message);
          }

        });

      }
    })


  }

};

