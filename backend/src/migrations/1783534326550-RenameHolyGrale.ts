import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameHolyGrale1783534326550 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "games" SET "gameType" = 'grail_quest' WHERE "gameType" = 'holy_grail'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "games" SET "gameType" = 'holy_grail' WHERE "gameType" = 'grail_quest'`);
    }

}
