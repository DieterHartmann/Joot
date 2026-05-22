-- CreateTable
CREATE TABLE "ba_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "subsidiary_id" UUID,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ba_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ba_session" (
    "id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "ba_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ba_account" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ba_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ba_verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ba_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ba_user_email_key" ON "ba_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ba_session_token_key" ON "ba_session"("token");

-- AddForeignKey
ALTER TABLE "ba_session" ADD CONSTRAINT "ba_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ba_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ba_account" ADD CONSTRAINT "ba_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ba_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
