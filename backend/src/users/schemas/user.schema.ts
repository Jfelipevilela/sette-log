import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  branchId?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: [String], default: ['operator'], index: true })
  roles: string[];

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ enum: ['active', 'inactive', 'blocked'], default: 'active', index: true })
  status: string;

  @Prop()
  driverId?: string;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, roles: 1, status: 1 });
