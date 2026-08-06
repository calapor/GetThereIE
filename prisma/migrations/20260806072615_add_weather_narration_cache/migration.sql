-- CreateTable
CREATE TABLE "WeatherCache" (
    "dateHour" TEXT NOT NULL PRIMARY KEY,
    "temperatureC" REAL,
    "precipitationMm" REAL,
    "windKmh" REAL,
    "fetchedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NarrationCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL
);
