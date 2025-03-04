-- CreateTable
CREATE TABLE "ApiEndpoint" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiEndpoint_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApiEndpoint" ADD CONSTRAINT "ApiEndpoint_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
