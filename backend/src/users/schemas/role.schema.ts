import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ enum: ['active', 'inactive'], default: 'active', index: true })
  status: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ tenantId: 1, key: 1 }, { unique: true });
