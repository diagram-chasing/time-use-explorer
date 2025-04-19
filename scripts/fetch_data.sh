#!/bin/bash

# Fetch the Parquet file from the data repository
wget https://github.com/Vonter/india-timeuse-survey/raw/refs/heads/main/data/individual_daily_schedule.parquet -O src/lib/assets/india_timeuse_survey.parquet

# Extract a 1% sample of rows from the Parquet file and filter the columns
duckdb -c "COPY (
  SELECT state, district, gender, age, marital_status, education, religion, 
         social_group, household_size, activity_code, activity_location, 
         monthly_expenditure, industry, time_from, time_to
  FROM read_parquet('src/lib/assets/india_timeuse_survey.parquet')
  USING SAMPLE 1%
) TO 'src/lib/assets/sample_1_perc.parquet' (FORMAT PARQUET);"