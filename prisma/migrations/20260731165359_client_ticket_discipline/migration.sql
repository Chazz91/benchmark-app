-- CreateEnum
CREATE TYPE "WorkingStatus" AS ENUM ('AVAILABLE', 'WORKING');

-- AlterTable
ALTER TABLE "Consultant" ADD COLUMN     "currentClientId" TEXT,
ADD COLUMN     "workingStatus" "WorkingStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "expiryNotice30SentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClientCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTicketRequirement" (
    "clientId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL DEFAULT 'BOTH',

    CONSTRAINT "ClientTicketRequirement_pkey" PRIMARY KEY ("clientId","ticketTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientCompany_name_key" ON "ClientCompany"("name");

-- AddForeignKey
ALTER TABLE "Consultant" ADD CONSTRAINT "Consultant_currentClientId_fkey" FOREIGN KEY ("currentClientId") REFERENCES "ClientCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTicketRequirement" ADD CONSTRAINT "ClientTicketRequirement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTicketRequirement" ADD CONSTRAINT "ClientTicketRequirement_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
