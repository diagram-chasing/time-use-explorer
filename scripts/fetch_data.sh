#!/bin/bash

# Fetch the Parquet file from the data repository
wget https://github.com/Vonter/india-timeuse-survey/raw/refs/heads/main/data/timeuse.parquet -O src/lib/assets/timeuse.parquet

# Filter the columns in the original Parquet file
duckdb -c "COPY (
  SELECT state, district, gender, age, marital_status, education, religion,
         sector, social_group, household_size, activity_code,
         activity_location, monthly_expenditure, industry, time_from, time_to,
         person_id, mult
          FROM read_parquet('src/lib/assets/india_timeuse_survey.parquet')
) TO 'src/lib/assets/india_timeuse_survey.parquet' (FORMAT PARQUET);"

# Extract a 1% sample of rows from the filtered Parquet file
duckdb -c "COPY (
  SELECT *
          FROM read_parquet('src/lib/assets/india_timeuse_survey.parquet')
  USING SAMPLE 1%
) TO 'src/lib/assets/sample_1_perc.parquet' (FORMAT PARQUET);"
