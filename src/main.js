const core = require('@actions/core')


async function run() {
  try {
    const bench_dir = core.getInput('bench_dir')
    const deploy_instance_meta_public_key = core.getInput('deploy_instance_meta_public_key')
    const deploy_custom_inventory_file_path = core.getInput('deploy_custom_inventory_file_path')
    const deploy_vars_file_path = core.getInput('deploy_vars_file_path')
    const deploy_variables = core.getInput('deploy_variables')
    const deploy_destroy_after_run = core.getInput('deploy_destroy_after_run')
    const deploy_lock_id = core.getInput('deploy_lock_id')
    const deploy_extra_file_uploaded_name = core.getInput('deploy_extra_file_uploaded_name')
    const deploy_extra_file_name = core.getInput('deploy_extra_file_name')
    const deploy_extra_file_target_path = core.getInput('deploy_extra_file_target_path')
    const snr_existing_config_path = core.getInput('snr_existing_config_path')
    const snr_def_cfg_dir = core.getInput('snr_def_cfg_dir')
    const snr_def_cfg_file_name = core.getInput('snr_def_cfg_file_name')
    const snr_def_cfg_inventory_file_path = core.getInput('snr_def_cfg_inventory_file_path')
    const snr_def_cfg_privilege_escalation = core.getInput('snr_def_cfg_privilege_escalation')
    const snr_def_cfg_private_key_file_path = core.getInput('snr_def_cfg_private_key_file_path')
    const snr_def_cfg_host_checking = core.getInput('snr_def_cfg_host_checking')
    const snr_directory = core.getInput('snr_directory')
    const snr_playbook_directory = core.getInput('snr_playbook_directory')
    const snr_execution_order = core.getInput('snr_execution_order')
    const snr_requirements = core.getInput('snr_requirements')
    const snr_extra_options_string = core.getInput('snr_extra_options_string')
    const snr_extra_options_file = core.getInput('snr_extra_options_file')
    const snr_extra_file_uploaded_name = core.getInput('snr_extra_file_uploaded_name')
    const snr_extra_file_name = core.getInput('snr_extra_file_name')
    const snr_extra_file_target_path = core.getInput('snr_extra_file_target_path')
    const eval_name = core.getInput('eval_name')
    const eval_metrics_to_evaluate = core.getInput('eval_metrics_to_evaluate')
    const eval_branch_with_bench_data = core.getInput('eval_branch_with_bench_data')
    const eval_previous_data_storage_folder = core.getInput('eval_previous_data_storage_folder')
    const eval_file_with_previous_bench_data = core.getInput('eval_file_with_previous_bench_data')
    const eval_bucket_results_folder_path = core.getInput('eval_bucket_results_folder_path')
    const eval_bucket_result_file_path = core.getInput('eval_bucket_result_file_path')
    const eval_local_download_path_for_results = core.getInput('eval_local_download_path_for_results')
    const eval_save_current_bench_res = core.getInput('eval_save_current_bench_res')
    const eval_add_action_page_job_summary = core.getInput('eval_add_action_page_job_summary')
    const eval_link_to_templated_gh_page_with_results = core.getInput('eval_link_to_templated_gh_page_with_results')
    const eval_comparison_margins = core.getInput('eval_comparison_margins')
    const eval_failing_condition = core.getInput('eval_failing_condition')
    const eval_bench_to_compare = core.getInput('eval_bench_to_compare')
    const eval_action_page_job_summary = core.getInput('eval_action_page_job_summary')
    const eval_evaluation_method = core.getInput('eval_evaluation_method')
    const eval_threshold_values = core.getInput('eval_threshold_values')
    const eval_comparison_operators = core.getInput('eval_comparison_operators')
    const eval_alert_users_if_bench_failed = core.getInput('eval_alert_users_if_bench_failed')
    const eval_comment_to_commit = core.getInput('eval_comment_to_commit')
    const eval_threshold_upper = core.getInput('eval_threshold_upper')
    const eval_threshold_lower = core.getInput('eval_threshold_lower')
    const eval_jump_detection_thresholds = core.getInput('eval_jump_detection_thresholds')
    const eval_trend_thresholds = core.getInput('eval_trend_thresholds')
    const eval_moving_ave_window_size = core.getInput('eval_moving_ave_window_size')
    const eval_extra_file_uploaded_name = core.getInput('eval_extra_file_uploaded_name')
    const eval_extra_file_name = core.getInput('eval_extra_file_name')
    const eval_extra_file_target_path = core.getInput('eval_extra_file_target_path')
    const eval_extra_options_string = core.getInput('eval_extra_options_string')
    const eval_extra_options_file = core.getInput('eval_extra_options_file')
    const eval_trend_det_no_sufficient_data_strategy = core.getInput('eval_trend_det_no_sufficient_data_strategy')
    const eval_trend_det_successful_release_branch = core.getInput('eval_trend_det_successful_release_branch')
    const eval_result_files_merge_strategy_for_each_metric = core.getInput('eval_result_files_merge_strategy_for_each_metric')

    // deploy_lock_id must be a string
    if (deploy_lock_id && typeof deploy_lock_id !== 'string') {
      core.setFailed('deploy_lock_id must be a string')
    }

    // snr_execution_order must be a string (for example, "deploy" or a comma separated string "deploy, run"
    if (snr_execution_order && typeof snr_execution_order !== 'string') {
      core.setFailed('snr_execution_order must be a string')
    }

    // deploy_vars_file_path must have .tfvars extension
    if (deploy_vars_file_path && !deploy_vars_file_path.endsWith('.tfvars')) {
      core.setFailed('deploy_vars_file_path must have .tfvars extension')
    }


    if (eval_bucket_results_folder_path && !eval_result_files_merge_strategy_for_each_metric) {
      core.setFailed('eval_result_files_merge_strategy_for_each_metric must be set if eval_bucket_results_folder_path is set')
    }

    if (eval_evaluation_method === 'threshold' && (!eval_threshold_values || !eval_comparison_operators || !eval_comparison_margins)) {
      core.setFailed('eval_threshold_values, eval_comparison_operators, and eval_comparison_margins must be set if eval_evaluation_method is set to thresholds')
    }

    if (eval_evaluation_method === 'threshold_range' && (!eval_threshold_upper || !eval_threshold_lower)) {
      core.setFailed('eval_threshold_upper and eval_threshold_lower must be set if eval_evaluation_method is set to threshold_range')
    }

    if (eval_evaluation_method === 'previous' || eval_evaluation_method === 'previous_successful') {
      if (!eval_comparison_operators || !eval_comparison_margins) {
        core.setFailed('eval_comparison_operators and eval_comparison_margins must be set if eval_evaluation_method is set to previous or previous_successful')
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
