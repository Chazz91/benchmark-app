/*
  Warnings:

  - You are about to drop the column `notes` on the `Evaluation` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Evaluation` table. All the data in the column will be lost.
  - Added the required column `knowledgeScore` to the `Evaluation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `overallScore` to the `Evaluation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `professionalismScore` to the `Evaluation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reportingScore` to the `Evaluation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `safetyScore` to the `Evaluation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "notes",
DROP COLUMN "score",
ADD COLUMN     "directSupervisor" TEXT,
ADD COLUMN     "evaluatorTitle" TEXT,
ADD COLUMN     "knowledgeComments" TEXT,
ADD COLUMN     "knowledgeScore" INTEGER NOT NULL,
ADD COLUMN     "lengthOfWork" TEXT,
ADD COLUMN     "overallComments" TEXT,
ADD COLUMN     "overallScore" INTEGER NOT NULL,
ADD COLUMN     "professionalismComments" TEXT,
ADD COLUMN     "professionalismScore" INTEGER NOT NULL,
ADD COLUMN     "reportingComments" TEXT,
ADD COLUMN     "reportingScore" INTEGER NOT NULL,
ADD COLUMN     "safetyComments" TEXT,
ADD COLUMN     "safetyScore" INTEGER NOT NULL,
ADD COLUMN     "typeOfWork" TEXT,
ADD COLUMN     "wouldRecommend" BOOLEAN;
