import { MigrationInterface, QueryRunner } from "typeorm";
import * as fs from 'fs';
import * as path from 'path';

export class CleanupGhostBots1783543778441 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Read aiConfig directly
        const configPath = path.join(__dirname, '..', 'game', 'aiConfig.json');
        const aiConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const validBotIds: string[] = [];
        
        for (const gameBots of Object.values(aiConfig)) {
            for (const bot of Object.values(gameBots as Record<string, any>)) {
                validBotIds.push(bot.id);
            }
        }
        
        const idList = validBotIds.map(id => `'${id}'`).join(',');
        
        // Delete user_stats for invalid bots
        await queryRunner.query(`
            DELETE FROM user_stats 
            WHERE "userId" IN (
                SELECT id FROM users 
                WHERE email LIKE 'bot-%' AND id NOT IN (${idList})
            )
        `);
        
        // Delete users for invalid bots
        await queryRunner.query(`
            DELETE FROM users 
            WHERE email LIKE 'bot-%' AND id NOT IN (${idList})
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Cannot revert deletion of ghost bots easily, safe to do nothing
    }
}
