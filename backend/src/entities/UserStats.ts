import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { GameType } from '@vibe-games/shared';

@Entity('user_stats')
@Unique(['userId', 'gameType'])
export class UserStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  gameType!: GameType;

  @Column({ type: 'integer', default: 1200 })
  elo!: number;

  @Column({ type: 'integer', default: 0 })
  wins!: number;

  @Column({ type: 'integer', default: 0 })
  losses!: number;

  @Column({ type: 'integer', default: 0 })
  draws!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
