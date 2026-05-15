export type AwsPageFetcher<TPage> = (nextToken?: string) => Promise<{ page: TPage; nextToken?: string | null }>;

export async function collectAwsPages<TPage>(fetchPage: AwsPageFetcher<TPage>): Promise<TPage[]> {
  const pages: TPage[] = [];
  let nextToken: string | undefined;

  while (true) {
    const result = await fetchPage(nextToken);
    pages.push(result.page);

    const normalized = typeof result.nextToken === "string" ? result.nextToken.trim() : "";
    if (!normalized) break;
    nextToken = normalized;
  }

  return pages;
}
