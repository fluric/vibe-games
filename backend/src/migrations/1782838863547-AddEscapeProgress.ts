import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEscapeProgress1782838863547 implements MigrationInterface {
    name = 'AddEscapeProgress1782838863547'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "escape_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "roomId" integer NOT NULL, "solvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f3250f58aaa91e0a42162166e48" UNIQUE ("userId", "roomId"), CONSTRAINT "PK_fdf5e77252096926976df3d9a8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "escape_progress" ADD CONSTRAINT "FK_45759e3faf25f3c8a52831dd3f8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "escape_progress" DROP CONSTRAINT "FK_45759e3faf25f3c8a52831dd3f8"`);
        await queryRunner.query(`DROP TABLE "escape_progress"`);
    }

}
