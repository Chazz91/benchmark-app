-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "expiryDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TicketType" ADD COLUMN     "hasExpiry" BOOLEAN NOT NULL DEFAULT true;
