-- CreateTable
CREATE TABLE "FlightQueryCache" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightQueryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlightQueryCache_queryKey_key" ON "FlightQueryCache"("queryKey");
