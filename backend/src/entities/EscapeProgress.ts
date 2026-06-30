import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';

/** Tracks a single player's progress for one escape room level. */
@Entity('escape_progress')
@Unique(['userId', 'roomId'])
export class EscapeProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  /** 1-indexed room number. */
  @Column({ type: 'integer' })
  roomId!: number;

  /** Set when the room is first solved; null while unsolved. */
  @Column({ type: 'timestamptz', nullable: true })
  solvedAt!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
