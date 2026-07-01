import { MigrationInterface, QueryRunner } from "typeorm";

export class ClearEscapeProgress1782938582433 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`TRUNCATE TABLE "escape_progress"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // cannot reverse a truncate easily
    }

}
