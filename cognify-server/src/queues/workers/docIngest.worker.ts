import { Worker, Job } from "bullmq";
import { redis } from "../../config/redis";
import { prisma } from "../../config/db";
import { fileParserService } from "../../services/storage/fileParser.service";
import { vectorMemoryService } from "../../services/ai/vectorMemory.service";
import { embeddingService } from "../../services/ai/embedding.service";
import { logger } from "../../config/logger";
import { registerWorker } from "../workerRegistry";
import { requestContextStorage } from "../../middleware/requestContext";
import { DocIngestJobData } from "../docIngestQueue";

const worker = new Worker<DocIngestJobData>(
  "doc-ingest",
  async (job: Job<DocIngestJobData>) => {
    const { fileId, workspaceId, filePath, mimetype, requestId } = job.data;
    const correlationId = requestId || `doc-${job.id}`;

    return requestContextStorage.run(
      {
        requestId: correlationId,
        workspaceId,
      },
      async () => {
        logger.info(`Starting background document ingestion for file ${fileId} (${mimetype})`);

        // 1. Verify file exists in database
        const fileRecord = await prisma.file.findUnique({
          where: { id: fileId },
        });

        if (!fileRecord) {
          throw new Error(`File ${fileId} not found in database`);
        }

        // 2. Parse file contents
        const parsedText = await fileParserService.parse(filePath, mimetype);
        if (!parsedText || parsedText.trim().length === 0) {
          logger.warn(`Document ${fileId} contained no extractable text`);
          return { chunksProcessed: 0 };
        }

        // 3. Chunk text cleanly with 100-character overlap
        const chunks = fileParserService.chunkText(parsedText, 600, 100);
        logger.info(`Extracted ${chunks.length} chunks from document ${fileRecord.original_name}`);

        // 4. Generate embeddings and store with tenant isolation
        let storedCount = 0;
        for (const chunk of chunks) {
          try {
            const vector = await embeddingService.generateEmbedding(chunk);
            await vectorMemoryService.addMemory(workspaceId, chunk, vector, fileId);
            storedCount += 1;
          } catch (chunkErr: any) {
            logger.error(`Error embedding chunk for file ${fileId}: ${chunkErr.message}`);
          }
        }

        // 5. Update File record with truncated preview
        await prisma.file.update({
          where: { id: fileId },
          data: {
            parsed_text: parsedText.slice(0, 10000),
          },
        });

        logger.info(
          `Document ingestion complete for ${fileRecord.original_name}: stored ${storedCount}/${chunks.length} chunks`
        );

        return { chunksProcessed: storedCount };
      }
    );
  },
  {
    connection: redis,
    concurrency: 3, // Bounded concurrency for document ingestion
  }
);

registerWorker(worker);

worker.on("completed", (job) => {
  logger.info(`Doc-ingest job ${job.id} for file ${job.data?.fileId} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Doc-ingest job ${job?.id} failed with error: ${err.message}`);
});

export default worker;
