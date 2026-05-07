export type DatabaseTypeValue =
  | "all"
  | "relational"
  | "key_value"
  | "in_memory"
  | "document"
  | "graph"
  | "wide_column"
  | "time_series";

export type DatabaseTypeOption = {
  value: DatabaseTypeValue;
  label: string;
};

export type ExplorerDrilldownInput = {
  databaseType: DatabaseTypeValue;
  dbService: string;
  dbEngine: string;
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/[\s_-]+/g, "");

type ServiceTaxonomy = {
  canonical: string;
  aliases: string[];
  engines?: string[];
};

type DatabaseTypeTaxonomy = {
  label: string;
  services: ServiceTaxonomy[];
  engines: string[];
};

export const DATABASE_TYPE_TAXONOMY: Record<Exclude<DatabaseTypeValue, "all">, DatabaseTypeTaxonomy> = {
  relational: {
    label: "Relational",
    services: [
      {
        canonical: "AmazonRDS",
        aliases: ["AmazonRDS", "Amazon RDS"],
        engines: ["MySQL", "PostgreSQL", "MariaDB", "Oracle", "SQL Server", "Db2"],
      },
      {
        canonical: "Aurora",
        aliases: ["Aurora", "Amazon Aurora"],
        engines: ["Aurora MySQL", "Aurora PostgreSQL"],
      },
    ],
    engines: ["MySQL", "PostgreSQL", "MariaDB", "Oracle", "SQL Server", "Db2", "Aurora MySQL", "Aurora PostgreSQL"],
  },
  key_value: {
    label: "Key-value",
    services: [{ canonical: "DynamoDB", aliases: ["DynamoDB", "Amazon DynamoDB"], engines: ["DynamoDB"] }],
    engines: ["DynamoDB"],
  },
  in_memory: {
    label: "In-memory",
    services: [
      { canonical: "ElastiCache", aliases: ["ElastiCache", "Amazon ElastiCache"], engines: ["Valkey", "Redis OSS", "Memcached"] },
      { canonical: "MemoryDB", aliases: ["MemoryDB", "Amazon MemoryDB"], engines: ["Valkey", "Redis OSS"] },
    ],
    engines: ["Valkey", "Redis OSS", "Memcached"],
  },
  document: {
    label: "Document",
    services: [{ canonical: "DocumentDB", aliases: ["DocumentDB", "Amazon DocumentDB"], engines: ["MongoDB-compatible"] }],
    engines: ["MongoDB-compatible"],
  },
  graph: {
    label: "Graph",
    services: [{ canonical: "Neptune", aliases: ["Neptune", "Amazon Neptune"], engines: ["Neptune Graph"] }],
    engines: ["Neptune Graph"],
  },
  wide_column: {
    label: "Wide column",
    services: [{ canonical: "Keyspaces", aliases: ["Keyspaces", "Amazon Keyspaces"], engines: ["Apache Cassandra-compatible"] }],
    engines: ["Apache Cassandra-compatible"],
  },
  time_series: {
    label: "Time series",
    services: [
      {
        canonical: "Timestream",
        aliases: ["Timestream", "Amazon Timestream"],
        engines: ["Timestream LiveAnalytics", "InfluxDB"],
      },
    ],
    engines: ["Timestream LiveAnalytics", "InfluxDB"],
  },
};

export const DATABASE_TYPE_OPTIONS: DatabaseTypeOption[] = [
  { value: "all", label: "All Database Types" },
  { value: "relational", label: "Relational" },
  { value: "key_value", label: "Key-value" },
  { value: "in_memory", label: "In-memory" },
  { value: "document", label: "Document" },
  { value: "graph", label: "Graph" },
  { value: "wide_column", label: "Wide column" },
  { value: "time_series", label: "Time series" },
];

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));

export const getServicesForDatabaseType = (databaseType: DatabaseTypeValue): string[] => {
  if (databaseType === "all") return [];
  return DATABASE_TYPE_TAXONOMY[databaseType].services.map((service) => service.canonical);
};

export const getEnginesForDatabaseType = (databaseType: DatabaseTypeValue): string[] => {
  if (databaseType === "all") return [];
  return DATABASE_TYPE_TAXONOMY[databaseType].engines;
};

export const shouldShowDbServiceFilter = (databaseType: DatabaseTypeValue): boolean => {
  if (databaseType === "all") return true;
  return getServicesForDatabaseType(databaseType).length > 1;
};

export const getEffectiveDbService = (databaseType: DatabaseTypeValue, selectedDbService: string): string => {
  const selected = selectedDbService.trim();
  if (databaseType === "all") return selected;

  const services = DATABASE_TYPE_TAXONOMY[databaseType].services;
  if (services.length === 1) {
    return services[0].canonical;
  }

  if (!selected) return "";
  const selectedKey = normalize(selected);
  const isValid = services.some((service) => [service.canonical, ...service.aliases].map(normalize).includes(selectedKey));
  return isValid ? selected : "";
};

export const getFilteredServiceOptions = (databaseType: DatabaseTypeValue, backendServiceOptions: string[]): string[] => {
  const options = uniqueSorted(backendServiceOptions);
  if (databaseType === "all") return options;

  const allowed = new Set(
    DATABASE_TYPE_TAXONOMY[databaseType].services.flatMap((service) => [service.canonical, ...service.aliases].map(normalize)),
  );
  return options.filter((option) => allowed.has(normalize(option)));
};

const getServiceScopedEngines = (databaseType: DatabaseTypeValue, effectiveDbService: string): string[] => {
  if (databaseType === "all") return [];
  const typeTaxonomy = DATABASE_TYPE_TAXONOMY[databaseType];
  if (!effectiveDbService.trim()) return typeTaxonomy.engines;

  const serviceMatch = typeTaxonomy.services.find((service) =>
    [service.canonical, ...service.aliases].map(normalize).includes(normalize(effectiveDbService)),
  );
  return serviceMatch?.engines ?? typeTaxonomy.engines;
};

export const getFilteredEngineOptions = (
  databaseType: DatabaseTypeValue,
  effectiveDbService: string,
  backendEngineOptions: string[],
): string[] => {
  const options = uniqueSorted(backendEngineOptions);
  if (databaseType === "all" && !effectiveDbService.trim()) return options;

  if (databaseType === "all" && effectiveDbService.trim()) {
    const matchedType = resolveDatabaseTypeForService(effectiveDbService);
    if (matchedType === "all") return options;
    const allowedEngines = new Set(getServiceScopedEngines(matchedType, effectiveDbService).map(normalize));
    const narrowed = options.filter((option) => allowedEngines.has(normalize(option)));
    return narrowed.length > 0 ? narrowed : options;
  }

  const allowedEngines = new Set(getServiceScopedEngines(databaseType, effectiveDbService).map(normalize));
  const narrowed = options.filter((option) => allowedEngines.has(normalize(option)));
  return narrowed.length > 0 ? narrowed : options;
};

export const shouldShowDbEngineFilter = (
  databaseType: DatabaseTypeValue,
  effectiveDbService: string,
  availableEngines: string[],
): boolean => {
  if (availableEngines.length <= 1) return false;
  if (databaseType === "all") return true;
  return getFilteredEngineOptions(databaseType, effectiveDbService, availableEngines).length > 1;
};

export const resolveDatabaseTypeForService = (dbService: string): DatabaseTypeValue => {
  const serviceKey = normalize(dbService);
  if (!serviceKey) return "all";
  for (const [type, taxonomy] of Object.entries(DATABASE_TYPE_TAXONOMY) as Array<
    [Exclude<DatabaseTypeValue, "all">, DatabaseTypeTaxonomy]
  >) {
    const hasMatch = taxonomy.services.some((service) =>
      [service.canonical, ...service.aliases].map(normalize).includes(serviceKey),
    );
    if (hasMatch) return type;
  }
  return "all";
};

export const resolveHierarchyFromEngine = (
  dbEngine: string,
): { databaseType: Exclude<DatabaseTypeValue, "all">; dbService: string } | null => {
  const engineKey = normalize(dbEngine);
  if (!engineKey) return null;
  for (const [type, taxonomy] of Object.entries(DATABASE_TYPE_TAXONOMY) as Array<
    [Exclude<DatabaseTypeValue, "all">, DatabaseTypeTaxonomy]
  >) {
    for (const service of taxonomy.services) {
      if ((service.engines ?? []).map(normalize).includes(engineKey)) {
        return { databaseType: type, dbService: service.canonical };
      }
    }
  }
  return null;
};

export const deriveAutoGroupBy = (
  databaseType: DatabaseTypeValue,
  dbService: string,
  dbEngine: string,
): "database_type" | "db_service" | "db_engine" => {
  if (dbEngine.trim()) return "db_engine";
  if (dbService.trim()) return "db_engine";
  if (databaseType !== "all") return "db_service";
  return "database_type";
};
