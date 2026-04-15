/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { DimTag } from "../../../models/index.js";
import { selectPrimarySupportedBusinessTag } from "./tag-normalization.service.js";

const toErrorMessage = (error) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
};

const isUniqueViolation = (error) => {
  const message = toErrorMessage(error).toLowerCase();
  const parentMessage =
    error && typeof error === "object" && "parent" in error && error.parent?.message
      ? String(error.parent.message).toLowerCase()
      : "";
  return (
    message.includes("duplicate key value violates unique constraint") ||
    parentMessage.includes("duplicate key value violates unique constraint")
  );
};

const serializeTagCacheKey = ({ tenantId, providerId, normalizedKey, normalizedValue }) =>
  JSON.stringify([tenantId, providerId, normalizedKey, normalizedValue]);

const createTagDimensionCache = () => new Map();

const resolveFactTagId = async ({
  tenantId,
  providerId,
  rawTags,
  tagCache,
}) => {
  const selectedTag = selectPrimarySupportedBusinessTag(rawTags);
  if (!selectedTag) return null;

  const where = {
    tenantId,
    providerId,
    normalizedKey: selectedTag.normalizedKey,
    normalizedValue: selectedTag.normalizedValue,
  };
  const cacheKey = serializeTagCacheKey({
    tenantId,
    providerId,
    normalizedKey: selectedTag.normalizedKey,
    normalizedValue: selectedTag.normalizedValue,
  });

  if (tagCache?.has(cacheKey)) {
    return tagCache.get(cacheKey);
  }

  const existing = await DimTag.findOne({ where });
  if (existing) {
    tagCache?.set(cacheKey, existing.id);
    return existing.id;
  }

  try {
    const created = await DimTag.create({
      tenantId,
      providerId,
      tagKey: selectedTag.tagKey,
      tagValue: selectedTag.tagValue,
      normalizedKey: selectedTag.normalizedKey,
      normalizedValue: selectedTag.normalizedValue,
    });
    tagCache?.set(cacheKey, created.id);
    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicated = await DimTag.findOne({ where });
      if (duplicated) {
        tagCache?.set(cacheKey, duplicated.id);
        return duplicated.id;
      }
    }
    throw new Error(`Failed to resolve dim_tag: ${toErrorMessage(error)}`);
  }
};

export { createTagDimensionCache, resolveFactTagId };

