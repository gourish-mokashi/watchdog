/*
  Warnings:

  - You are about to drop the column `severity` on the `event` table. All the data in the column will be lost.
  - Added the required column `priority` to the `event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event" DROP COLUMN "severity",
ADD COLUMN     "priority" TEXT NOT NULL;
