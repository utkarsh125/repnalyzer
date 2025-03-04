-- CreateTable
CREATE TABLE "ApiConnection" (
    "id" SERIAL NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiConnection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApiConnection" ADD CONSTRAINT "ApiConnection_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
