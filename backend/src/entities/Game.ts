import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { GameType, GameStatus, MillGameState } from '@vibe-games/shared';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  gameType!: GameType;

  @Column({ type: 'varchar', length: 20, default: 'waiting' })
  status!: GameStatus;

  @Column({ type: 'uuid', nullable: true })
  playerXId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  playerOId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  winnerId!: string | null;

  @Column({ type: 'jsonb' })
  state!: MillGameState; // Extensible state based on gameType

  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'playerXId' })
  playerX!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'playerOId' })
  playerO!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winnerId' })
  winner!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
