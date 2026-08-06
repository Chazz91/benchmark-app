-- CreateTable
CREATE TABLE "SystemStatus" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastCronRunAt" TIMESTAMP(3),
    "lastCronResult" TEXT,

    CONSTRAINT "SystemStatus_pkey" PRIMARY KEY ("id")
);
