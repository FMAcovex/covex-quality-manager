-- Manual status is a distinct immutable decision, not electronic approval.
ALTER TABLE "ControlledRevisionDecision" DROP CONSTRAINT IF EXISTS "ControlledRevisionDecision_operation_check";
ALTER TABLE "ControlledRevisionDecision" ADD CONSTRAINT "ControlledRevisionDecision_operation_check" CHECK ("operation" IN ('VERIFY','REGISTER_EXTERNAL','CONTRAST_EXTERNAL','SUBMIT','PLAN','ACTIVATE','RETIRE','ANNUL','RECTIFY','MANUAL_STATUS'));
