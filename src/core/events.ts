import { FastifyRequest, FastifyReply } from 'fastify'
import { ObjectId } from 'mongodb'
import { UtilInstance, Event } from '../types'
import Common from './common'

export default class Events {
  constructor() {}

  route(util: UtilInstance): void {
    const _collection = this.constructor.name.toLowerCase()
    const collection = util.db.collection<Event>(_collection)
    new Common(util, this.constructor.name)

    util.fastify.route({
      method: 'GET',
      url: `/${_collection}`,
      schema: {
        tags: [_collection],
        description: `${_collection} Info`,
        security: [{ apiauth: [] }],
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        const events = await collection.find({ 
          email: { "$eq": null, "$exists": false } 
        }).toArray()
        reply.status(200).send(events)
      }
    })

    // Add other routes similarly...
  }

  async log(util: UtilInstance, details: Record<string, any>): Promise<any> {
    const collection = util.db.collection<Event>(this.constructor.name.toLowerCase())
    const schema: Partial<Event> = {
      details,
      created: new Date(),
    }
    util.fastify.log.info(schema)
    return await collection.insertOne(schema as Event)
  }

  async email(util: UtilInstance, details: Record<string, any>): Promise<any> {
    const collection = util.db.collection<Event>(this.constructor.name.toLowerCase())
    const schema: Partial<Event> = {
      details,
      email: true,
      log: [{ status: "pending", updated: new Date() }],
      created: new Date()
    }
    util.fastify.log.info(schema)
    return await collection.insertOne(schema as Event)
  }

  async notification(util: UtilInstance, details: Record<string, any>): Promise<any> {
    const collection = util.db.collection<Event>(this.constructor.name.toLowerCase())
    const schema: Partial<Event> = {
      details,
      notification: true,
      log: [{ status: "pending", updated: new Date() }],
      created: new Date()
    }
    util.fastify.log.info(schema)
    return await collection.insertOne(schema as Event)
  }
} 