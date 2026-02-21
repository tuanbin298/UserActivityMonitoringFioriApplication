import { ValueState } from "sap/ui/core/library";

const Formatter = {
  // Format Icon Login Result
  formatLoginResultIcon: function (sValue: string): string {
    if (sValue === "SUCCESS") {
      return "sap-icon://message-success";
    } else {
      return "sap-icon://message-error";
    }
  },

  //   Formate State Login Result
  formatLoginResultState: function (sValue: string): ValueState {
    if (sValue === "SUCCESS") {
      return ValueState.Success;
    } else {
      return ValueState.Error;
    }
  },

  //   Format State Login Message
  formatLoginMessageState: function (sValue: string): ValueState {
    if (sValue === "AU2" || sValue === "BU1") {
      return ValueState.Error;
    } else {
      return ValueState.Success;
    }
  },

  // Format Icon Login Message
  formatLoginMessageIcon: function (sValue: string): string {
    if (sValue === "AU2" || sValue === "BU1") {
      return "sap-icon://message-error";
    } else {
      return "sap-icon://message-success";
    }
  },
};

export default Formatter;
