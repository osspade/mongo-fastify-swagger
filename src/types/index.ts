import { FastifyInstance } from 'fastify'
import { Db, ObjectId } from 'mongodb'
import mongoose from 'mongoose'

export interface UtilInstance {
  fastify: FastifyInstance;
  db: Db;
  orm: typeof mongoose;
}

export interface Account {
  _id: ObjectId;
  roles: string[];
  profile: {
    email: string;
    firstname: string;
    lastname: string;
    phone: string;
    language: string;
  };
  authkey?: string;
  password?: string;
}

export interface Form {
  _id: ObjectId;
  title: string;
  data: Record<string, any>;
  response: any[];
}

export interface Upload {
  _id: ObjectId;
  title: string;
  notes: string;
  files: Array<{
    filename: string;
    path: string;
  }>;
  account?: { _id: ObjectId };
  share: any[];
  created: Date;
}

export interface Event {
  _id: ObjectId;
  details: Record<string, any>;
  email?: boolean;
  notification?: boolean;
  log?: Array<{
    status: string;
    updated: Date;
    errors?: any;
  }>;
  created: Date;
}

export interface Product {
  _id: ObjectId;
  en: {
    title: string;
    description: string;
  };
  fr?: {
    title: string;
    description: string;
  };
  total: number;
  subscription: Record<string, any>;
  upload?: Array<{ _id: ObjectId }>;
}

export interface Order {
  _id: ObjectId;
  product: Array<{ _id: ObjectId }>;
  account?: { _id: ObjectId };
} 