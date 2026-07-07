import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRlChampion1783400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Delete user stats first to avoid FK constraints if cascade isn't configured at DB level
        await queryRunner.query(`DELETE FROM "user_stats" WHERE "userId" IN (SELECT id FROM "users" WHERE "username" = 'Neural Champion (RL)')`);
        // Remove from games where they are a player
        await queryRunner.query(`DELETE FROM "games" WHERE "playerXId" IN (SELECT id FROM "users" WHERE "username" = 'Neural Champion (RL)')`);
        await queryRunner.query(`DELETE FROM "games" WHERE "playerOId" IN (SELECT id FROM "users" WHERE "username" = 'Neural Champion (RL)')`);
        // Finally remove the user
        await queryRunner.query(`DELETE FROM "users" WHERE "username" = 'Neural Champion (RL)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No down migration for this specific cleanup
    }
}
