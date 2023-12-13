const core = require('@actions/core')
const fs = require('fs')
const {getCompleteBenchData} = require('./bench_data')
const path = require("path");

module.exports.getBoolInput = function (inputName) {
  const input = core.getInput(inputName)
  if (!input) {
    return false
  }
  if (input !== 'true' && input !== 'false') {
    throw new Error(
      `'${inputName}' input must be boolean value 'true' or 'false' but got '${input}'`
    )
  }
  return input === 'true'
}

module.exports.validateInputAndFetchConfig = function () {
  const benchGroupName = core.getInput('eval_bench_group_name')
  const failingCondition = core.getInput('eval_failing_condition')
  if (
    failingCondition !== 'any' &&
    failingCondition !== 'all' &&
    failingCondition !== 'none'
  ) {
    throw new Error(
      `Invalid failing condition: ${failingCondition}. Valid values are: any, all, none`
    )
  }

  let benchGroupToCompare = core.getInput('eval_bench_group_to_compare')
  if (benchGroupToCompare === '' || benchGroupToCompare === null) {
    benchGroupToCompare = benchGroupName
  }

  const evalPreviousDataStorageFolder = core.getInput('eval_previous_data_storage_folder')
  const evalFileWithPreviousBenchData = core.getInput('eval_file_with_previous_bench_data')
  let itemCount = parseInt(core.getInput('number_of_metrics_to_evaluate'))
  module.exports.validateAndFetchEvaluationConfig(itemCount, benchGroupToCompare,
    evalPreviousDataStorageFolder, evalFileWithPreviousBenchData);

  const githubToken = core.getInput('eval_github_token')

   module.exports.validateAndGet('eval_comment_to_commit')
   module.exports.validateAndGet('eval_action_page_job_summary')
   module.exports.getBoolInput('eval_save_curr_bench_res')
   module.exports.validateUsersToBeAlerted()
   module.exports.validateLinkToTemplatedGhPageWithResults();

}

module.exports.validateLinkToTemplatedGhPageWithResults = function () {
  const linkToTemplatedGhPageWithResults = core.getInput('eval_link_to_templated_gh_page_with_results');
  // link must be https and have github.io in it
  if (linkToTemplatedGhPageWithResults !== '') {
    if (!linkToTemplatedGhPageWithResults.startsWith('https://')) {
      throw new Error(`Link to templated gh page must start with 'https://' but got '${linkToTemplatedGhPageWithResults}'`);
    }
    if (!linkToTemplatedGhPageWithResults.includes('github.io')) {
      throw new Error(`Link to templated gh page must contain 'github.io' but got '${linkToTemplatedGhPageWithResults}'`);
    }
  }
  return linkToTemplatedGhPageWithResults;
}

module.exports.validateUsersToBeAlerted = function () {
  let alertUsersIfBenchFailed = core.getInput('eval_alert_users_if_bench_failed');
  if (alertUsersIfBenchFailed !== '') {
    alertUsersIfBenchFailed = alertUsersIfBenchFailed.split(',').map(u => u.trim());
    for (const u of alertUsersIfBenchFailed) {
      if (!u.startsWith('@')) {
        throw new Error(`User name in 'alert_users_if_bench_failed' input must start with '@' but got '${u}'`);
      }
    }
  }
  return alertUsersIfBenchFailed;
}

module.exports.validateAndGet = function (inputName) {
  const input = core.getInput(inputName);
  if (input !== 'on' && input !== 'off' && input !== 'if_failed') {
    throw new Error(
      `'${inputName}' input must be either 'on', 'off', or 'if_failed' but got '${input}'`
    )
  }
  return input
}

module.exports.camelToSnake = function (string) {
  return string
    .replace(/\w([A-Z])/g, function (m) {
      return m[0] + '_' + m[1]
    })
    .toLowerCase()
}

module.exports.validateAndFetchEvaluationConfig = function (currentResultLength,benchToCompare,
                                                            folderWithBenchData, fileWithBenchData) {
  // Evaluation method
  const evaluationMethod = core.getInput('eval_evaluation_method', { required: true })
  const validEvaluationMethods = [
    'threshold',
    'previous',
    'previous_successful',
    'threshold_range',
    'jump_detection',
    'trend_detection_moving_ave',
    'trend_detection_deltas'
  ]
  if (!validEvaluationMethods.includes(evaluationMethod)) {
    throw new Error(
      `Invalid evaluation method: ${evaluationMethod}. Must be one of ${validEvaluationMethods.join(
        ', '
      )}`
    )
  }

  let benchmarkData = getCompleteBenchData(folderWithBenchData, fileWithBenchData);
  if (benchmarkData === null) {
    core.info("No previous data found. Hence, the only valid evaluation method is threshold and threshold range." +
      "The action will fail if the evaluation method is not one of these two.");
    if (evaluationMethod !== 'threshold' && evaluationMethod !== 'threshold_range') {
      throw new Error(
        `Invalid evaluation method: ${evaluationMethod}. Must be one of threshold or threshold_range.`
      )
    }
  }
  switch (evaluationMethod) {
    case 'threshold':
      console.log('Validating threshold evaluation configuration.')
      module.exports.validateOperatorsAndMargins(currentResultLength)
      module.exports.validateThresholdConfig(currentResultLength)
      break
    case 'previous':
      console.log('Validating previous evaluation configuration.')
      module.exports.validateOperatorsAndMargins(currentResultLength)
      module.exports.checkIfNthPreviousBenchmarkExists(benchmarkData, benchToCompare, 1);
      break
    case 'previous_successful':
      console.log('Validating previous successful evaluation configuration.')
      module.exports.validateOperatorsAndMargins(currentResultLength)
      module.exports.checkIfPreviousSuccessfulExists(benchmarkData, benchToCompare);
      break
    case 'threshold_range':
      console.log('Validating threshold range evaluation configuration.')
      module.exports.validateThresholdRangeConfig(currentResultLength)
      break
    case 'jump_detection':
      console.log('Validating jump detection evaluation configuration.')
      module.exports.checkIfNthPreviousBenchmarkExists(benchmarkData, benchToCompare, 1);
      module.exports.validateJumpDetectionConfig(currentResultLength)
      break
    case 'trend_detection_moving_ave':
      core.debug('Validating trend detection with moving average evaluation configuration.')
      module.exports.validateTrendDetectionMovingAveConfig(currentResultLength)
      const movingAveWindowSize = core.getInput('eval_moving_ave_window_size')
      try {
        module.exports.checkIfNthPreviousBenchmarkExists(benchmarkData, benchToCompare,
          movingAveWindowSize);
      } catch (error) {
        // Depending on the value of the trend_det_no_sufficient_data_strategry input,
        // we either fail or use available data
        const noSufficientDataStrategy = core.getInput('eval_trend_det_no_sufficient_data_strategy');
        if (noSufficientDataStrategy === 'fail') {
          throw error;
        } else if (noSufficientDataStrategy === 'use_available') {
          const numberOfBenchsForName = benchmarkData.entries[benchToCompare].length;
          const stringOfNumberOfBenchs= numberOfBenchsForName.toString();
          core.info(`Not enough data for trend detection with moving average. Using available data.`)
          process.env[`INPUT_MOVING_AVE_WINDOW_SIZE`] = stringOfNumberOfBenchs;
          const newVal = core.getInput('eval_moving_ave_window_size');
          core.info(`New value for moving_ave_window: ${newVal}`)
        } else {
          throw new Error(`Invalid value for trend_det_no_sufficient_data_strategy: 
                ${noSufficientDataStrategy}. Valid values are: fail, use_available_data.`)
        }
      }


      break
    case 'trend_detection_deltas':
      module.exports.validateTrendThreshold(currentResultLength);
      module.exports.checkForWeekOldBenchmark(benchmarkData, benchToCompare);
      module.exports.checkIfNthPreviousBenchmarkExists(benchmarkData, benchToCompare,1);
      break
    default:
      throw new Error(
        `Unsupported evaluation method: ${evaluationMethod}`
      )
  }
}

module.exports.validateOperatorsAndMargins = function (currentResultLength) {
  console.log('Validating operators and margins')
  const comparisonOperatorsInput = core.getInput('eval_comparison_operators')
  const comparisonMarginsInput = core.getInput('eval_comparison_margins')

  if (!comparisonOperatorsInput || !comparisonMarginsInput) {
    throw new Error('Comparison operators and margins must not be null.')
  }
  const comparisonOperators = comparisonOperatorsInput.split(',')
  const comparisonMargins = comparisonMarginsInput.split(',').map(Number)
  if (comparisonOperators.length !== currentResultLength) {
    throw new Error(
      `The number of comparison operators must be equal to ${currentResultLength}.`
    )
  }
  if (comparisonMargins.length !== currentResultLength) {
    throw new Error(
      `The number of comparison margins must be equal to ${currentResultLength}.`
    )
  }
  const validOperators = ['smaller', 'bigger', 'tolerance']
  comparisonOperators.forEach(operator => {
    if (!validOperators.includes(operator.trim())) {
      throw new Error(
        `Invalid comparison operator: ${operator}. Valid operators are: ${validOperators.join(
          ', '
        )}.`
      )
    }
  })

  const validMargins = comparisonMargins.every(
    margin => margin === -1 || (margin >= 0 && margin <= 100)
  )
  if (!validMargins) {
    throw new Error('Comparison margins must be in the range [-1, 100].')
  }
}

module.exports.validateThresholdConfig = function (currentResultLength) {
  console.log('Validating threshold config')
  const thresholdValuesInput = core.getInput('eval_threshold_values')
  const thresholdValues = thresholdValuesInput
    .split(',')
    .map(value => value.trim())

  if (thresholdValues.length !== currentResultLength) {
    throw new Error(
      `The number of threshold values (${thresholdValues.length}) must match the number of metrics (${currentResultLength}).`
    )
  }
}
module.exports.validateThresholdRangeConfig = function (currentResultLength) {
  const thresholdUpperInput = core.getInput('eval_threshold_upper');
  const thresholdLowerInput = core.getInput('eval_threshold_lower');

  if (!thresholdUpperInput || !thresholdLowerInput) {
    throw new Error(
      'Threshold range values are required for the threshold_range evaluation method.'
    );
  }

  const thresholdUpper = thresholdUpperInput.split(',').map(Number);
  const thresholdLower = thresholdLowerInput.split(',').map(Number);

  if (thresholdUpper.length !== thresholdLower.length) {
    throw new Error(
      'The number of upper thresholds must match the number of lower thresholds.'
    );
  }

  if (thresholdUpper.length !== currentResultLength) {
    throw new Error(
      'The number of thresholds must match the number of results.'
    );
  }

  for (let i = 0; i < thresholdUpper.length; i++) {
    if (thresholdUpper[i] < 0 || thresholdLower[i] < 0) {
      throw new Error(
        'Threshold values must be non-negative numbers.'
      );
    }

    if (thresholdUpper[i] <= thresholdLower[i]) {
      throw new Error(
        'Each upper threshold must be greater than its corresponding lower threshold.'
      );
    }
  }
}

module.exports.validateJumpDetectionConfig = function (currentResultLength) {
  const jumpDetectionThresholdsInput = core.getInput('eval_jump_detection_thresholds')

  if (jumpDetectionThresholdsInput.trim() === '') {
    throw new Error('Jump detection threshold must be provided.')
  }

  const jumpDetectionThresholds = jumpDetectionThresholdsInput.split(',').map(Number)

  if (jumpDetectionThresholds.length !== currentResultLength) {
    throw new Error(
      'The number of jump det thresholds must match the number metrics.'
    )
  }
  jumpDetectionThresholds.forEach(value => {
    if (value < 0 || value > 100) {
      throw new Error(`Value ${value} is out of range [0,100]`);
    }
  });

  return jumpDetectionThresholds
}

module.exports.validateTrendThreshold = function (currentResultLength) {
  core.debug(`----- validateTrendThreshold -----`)
  const trendThresholds = core.getInput('eval_trend_thresholds')
  core.debug(`currentResultLength: ${currentResultLength}`)
  core.debug(`trendThresholds: ${trendThresholds}`)
  if (trendThresholds == null) {
    throw new Error(
      'trendThresholds must be provided for trend detection with moving average or trend detection deltas'
    )
  }

  const thresholdValues = trendThresholds.split(',').map(s => Number(s.trim()));

  if (thresholdValues.length !== currentResultLength) {
    throw new Error(
      'The number of thresholds must match the number metrics.'
    )
  }
  thresholdValues.forEach(value => {
    if (value < 0 || value > 100) {
      throw new Error(`Value ${value} is out of range [0,100]`);
    }
  });
}

module.exports.validateTrendDetectionMovingAveConfig = function (currentResultLength) {
  module.exports.validateTrendThreshold(currentResultLength);

  // window size part
  const movingAveWindowSize = core.getInput('eval_moving_ave_window_size')
  if (movingAveWindowSize == null) {
    throw new Error(
      'Both movingAveWindowSize must be provided for trend detection with moving average.'
    )
  }

}

module.exports.checkIfNthPreviousBenchmarkExists = function (
  benchmarkData,
  benchmarkName,
  numberOfBenchmarks
) {
  console.log(
    `Checking if benchmark "${benchmarkName}" has ${numberOfBenchmarks} previous entries.`
  )

  if (!benchmarkData.entries.hasOwnProperty(benchmarkName)) {
    throw new Error(`No benchmarks found with the name "${benchmarkName}"`)
  }

  const benchmarks = benchmarkData.entries[benchmarkName]

  benchmarks.sort((a, b) => b.date - a.date)

  if (numberOfBenchmarks <= 0 || numberOfBenchmarks > benchmarks.length) {
    throw new Error(
      `Cannot return ${numberOfBenchmarks} previous benchmark(s) - insufficient data.`
    )
  }
}

module.exports.checkIfPreviousSuccessfulExists = function(data, benchmarkKey) {
  console.log(`Checking if previous successful benchmark exists under '${benchmarkKey}'`)
  if (!data.entries.hasOwnProperty(benchmarkKey)) {
    throw new Error(`No such benchmark key: '${benchmarkKey}' exists.`);
  }

  let benchmarks = data.entries[benchmarkKey];
  let successfulBenchmarkExists = benchmarks.some(benchmark => benchmark.benchSuccessful);

  if (successfulBenchmarkExists) {
    console.log(`A previous successful benchmark under '${benchmarkKey}' exists.`);
  } else {
    console.log(`No successful benchmark under '${benchmarkKey}' exists.`);
  }
}

module.exports.validateTrendDetectionDeltasConfig = function () {
  const trendThresholds = core.getInput('eval_trend_thresholds')

  if (trendThresholds == null) {
    throw new Error(
      'trendThresholds must be provided for trend detection.'
    )
  }

  const trendThresholdsNum = Number(trendThresholds)
  if (
    isNaN(trendThresholdsNum) ||
    trendThresholdsNum < 0 ||
    trendThresholdsNum > 100
  ) {
    throw new Error('trendThresholds must be a number between 0 and 100.')
  }
}

module.exports.checkForWeekOldBenchmark = function(data, benchmarkKey) {

  const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (!data.entries.hasOwnProperty(benchmarkKey)) {
    throw new Error(`No such benchmark key: '${benchmarkKey}' exists.`);
  }
  let benchmarks = data.entries[benchmarkKey];
  let weekOldBenchmarkExists = benchmarks.some(benchmark => {
    let benchmarkAge = now - benchmark.date;
    return benchmarkAge >= (ONE_WEEK_IN_MS - DAY_IN_MS) && benchmarkAge <= (ONE_WEEK_IN_MS + DAY_IN_MS);
  });

  if (!weekOldBenchmarkExists) {
    throw new Error(`No benchmark under '${benchmarkKey}' is approximately one week old.`);
  } else {
    console.log(`A benchmark under '${benchmarkKey}' is approximately one week old.`);
  }
}


module.exports.validateStrategies = function(directory, strategies, outputFile, metricsToEvaluate) {
  const validStrategies = ['sum', 'average', 'min', 'max', 'median'];

  let evaluatedMetrics;
  if (metricsToEvaluate) {
    evaluatedMetrics = metricsToEvaluate.split(',').map(metric => metric.trim());
    if (evaluatedMetrics.length !== strategies.length) {
      throw new Error('The number of metrics in metricsToEvaluate does not match the number of provided strategies');
    }
  }


}


