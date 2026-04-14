import MessageBox from "sap/m/MessageBox";
import Controller from "sap/fe/core/PageController";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import Formatter from "useraudit/formatter/Formatter";
import Select from "sap/m/Select";
import Table from "sap/ui/table/Table";
import DatePicker from "sap/m/DatePicker";
import DateFormat from "sap/ui/core/format/DateFormat";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import Input from "sap/m/Input";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import MessageToast from "sap/m/MessageToast";
export default class UserDetail extends Controller {
  public formatter = Formatter;

  private _oAuthViewSettingsDialog: Dialog | null = null;
  private _oActViewSettingsDialog: Dialog | null = null;
  private _sFromDate!: string;
  private _sToDate!: string;
  private _oTCodeSearchHelpDialog: Dialog | null = null;
  private _sUsername: string = "";

  /**
   * Called when the controller is initialized.
   **/
  public onInit(): void {
    super.onInit();

    const oRouter = (this as any).getAppComponent().getRouter();
    if (oRouter) {
      oRouter
        .getRoute("UserDetail")
        .attachPatternMatched(this._onObjectMatched, this);
    }
  }

  /**
   * Get date from Global filter and format it
   * because date from DateRange filter is object
   * START
   **/
  private getGlobalDateFilter(): Filter[] {
    const { from, to } = this.getGlobalDateRange();

    return [
      new Filter({
        path: "LoginDate",
        operator: FilterOperator.BT,
        value1: from,
        value2: to,
      }),
    ];
  }

  private getGlobalDateRange() {
    const oComponent = this.getAppComponent();
    const oGlobalModel = oComponent?.getModel("global") as JSONModel;

    if (!oGlobalModel) {
      return { from: "", to: "" };
    }

    const oFrom = oGlobalModel.getProperty("/fromDate");
    const oTo = oGlobalModel.getProperty("/toDate");

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    return {
      from: formatDate(oFrom),
      to: formatDate(oTo),
    };
  }
  /**
   * END
   **/

  /**
   * Handles route matching for AuthDetail page
   * and loads detail data based on the navigation key.
   **/
  private async _onObjectMatched(oEvent: any): Promise<void> {
    // Get parameter from URL
    const sUsername = oEvent.getParameter("arguments").username;

    this._sUsername = sUsername;

    const oView = this.getView();
    if (!oView || !sUsername) return;

    oView.setBusy(true);

    try {
      await Promise.all([
        this._loadUserDetail(sUsername),
        this._loadUserLogs(sUsername),
        this._loadUserAuthLogPerDay(sUsername),
        this._loadUserActivity(sUsername),
      ]);
    } catch (oError) {
      MessageBox.error("Failed to load user data. Please try again.");
    } finally {
      oView.setBusy(false);
    }
  }

  /**
   * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
   * This hook is the same one that SAPUI5 controls get after being rendered.
   * @memberOf useraudit.controller.UserDetail
   */
  public onAfterRendering(): void {
    const { from, to } = this.getGlobalDateRange();

    // Set range in date picker
    const oDatePicker = this.byId("AuthDatePickerId") as DatePicker;
    const oActDatePicker = this.byId("ActivityDatePickerId") as DatePicker;

    if (!oDatePicker) return;

    oDatePicker.setMinDate(new Date(from));
    oDatePicker.setMaxDate(new Date(to));

    oActDatePicker.setMinDate(new Date(from));
    oActDatePicker.setMaxDate(new Date(to));
  }

  /**
   * Load user detail information
   **/
  private async _loadUserDetail(sUsername: string): Promise<void> {
    const oView = this.getView();
    const oModel = (this as any).getAppComponent().getModel() as ODataModel;

    // Create a list binding to /UserDetail with $filter
    const oUserDetai = oModel.bindList("/UserDetail", undefined, undefined, [
      new Filter("UserName", FilterOperator.EQ, sUsername),
    ]) as ODataListBinding;

    // Executes the OData call
    const aContexts = await oUserDetai.requestContexts(0, 1);

    // Set data into model
    if (aContexts.length > 0) {
      const oData = aContexts[0].getObject();
      const oUserDetailModel = new JSONModel(oData);

      oView?.setModel(oUserDetailModel, "UserDetailData");
    } else {
      MessageBox.error("Failed to load user detail data. Please try again.");
    }
  }

  /**
   * Load user auth log
   **/
  private async _loadUserLogs(sUsername: string): Promise<void> {
    const oUserAuthLogPerDayData = {} as any;

    const oModel = (this as any).getAppComponent().getModel() as ODataModel;

    // Create a list binding to /AuthLogChartByUser with $filter
    const oUserAuthChart = oModel.bindList(
      "/AuthLogChartByUser",
      undefined,
      undefined,
      [
        new Filter("Username", FilterOperator.EQ, sUsername),
        ...this.getGlobalDateFilter(),
      ],
    ) as ODataListBinding;

    // ===== Fetch ALL data using paging =====
    const aContextsChart: any[] = [];
    let iSkip = 0;
    const iPageSize = 100;

    while (true) {
      const aContexts = await oUserAuthChart.requestContexts(iSkip, iPageSize);

      if (aContexts.length === 0) break;

      aContextsChart.push(...aContexts);

      if (aContexts.length < iPageSize) break;

      iSkip += iPageSize;
    }

    const aDataChart = aContextsChart.map((oContext) => oContext.getObject());

    // Group by + SUM data
    aDataChart.forEach((oContext) => {
      const key = oContext.LoginResult;

      if (!oUserAuthLogPerDayData[key]) {
        oUserAuthLogPerDayData[key] = {
          LoginResult: oContext.LoginResult,
          CountLoginLog: 0,
        };
      }

      oUserAuthLogPerDayData[key].CountLoginLog += oContext.CountLoginLog;
    });

    //  Convert into array
    let aUserAuthLogPerDayData = Object.values(oUserAuthLogPerDayData);

    const oJsonModel = new JSONModel(aUserAuthLogPerDayData);

    // Set data into Model AuthLogChartByUser
    this.getView()?.setModel(oJsonModel, "AuthLogChartByUserData");

    // Create a list binding to /UserAuthLog with $filter
    const oUserAuthTable = oModel.bindList(
      "/UserAuthLog",
      undefined,
      undefined,
      [
        new Filter("Username", FilterOperator.EQ, sUsername),
        ...this.getGlobalDateFilter(),
      ],
    ) as ODataListBinding;

    const aContextsTable = await oUserAuthTable.requestContexts();
    const aDataTable = aContextsTable.map((oContext) => oContext.getObject());

    const oTableModel = new JSONModel(aDataTable);
    this.getView()?.setModel(oTableModel, "UserAuthLogData");
  }

  /**
   * Load User Auth Log Per Day
   **/
  private async _loadUserAuthLogPerDay(sUsername: string): Promise<void> {
    const oLogUserPerDay = {} as any;

    const oModel = (this as any).getAppComponent().getModel() as ODataModel;

    // Create a list binding to /UserAuthLogPerDay with $filter
    const oUserAuthLogPerDay = oModel.bindList(
      "/UserAuthLogPerDay",
      undefined,
      undefined,
      [
        new Filter("UserName", FilterOperator.EQ, sUsername),
        ...this.getGlobalDateFilter(),
      ],
    ) as ODataListBinding;

    const aContextsLogPerDay = await oUserAuthLogPerDay.requestContexts();

    aContextsLogPerDay.forEach((oContext) => {
      const oObj = oContext.getObject();

      const key = oObj.LoginDate;

      if (!oLogUserPerDay[key]) {
        oLogUserPerDay[key] = {
          LoginDate: oObj.LoginDate,
          TotalLoginCount: 0,
        };
      }

      oLogUserPerDay[key].TotalLoginCount += oObj.TotalLoginCount;
    });

    //  Convert into array
    let aLogUserPerDay = Object.values(oLogUserPerDay);

    const oLogPerDaModel = new JSONModel(aLogUserPerDay);

    this.getView()?.setModel(oLogPerDaModel, "UserAuthLogPerDayData");
  }

  /**
   * Load user activity information
   **/
  private async _loadUserActivity(sUsername: string): Promise<void> {
    const { from, to } = this.getGlobalDateRange();

    const oTCodePerUserData = {} as any;

    const oModel = (this as any).getAppComponent().getModel() as ODataModel;

    // Create a list binding to /ActivityTCodeByUser with $filter
    const oActivityTCodeByUser = oModel.bindList(
      "/ActivityTCodeByUser",
      undefined,
      undefined,
      [
        new Filter("Username", FilterOperator.EQ, sUsername),
        new Filter({
          path: "ActivityDate",
          operator: FilterOperator.BT,
          value1: from,
          value2: to,
        }),
      ],
    ) as ODataListBinding;

    // Executes the OData call
    const aContextsActivityTCodeByUser =
      await this.fetchAllData(oActivityTCodeByUser);

    // Group by + SUM data
    aContextsActivityTCodeByUser.forEach((oContext) => {
      const key = oContext.TCode;

      // If TCode is exist, plus TCodeCount, else create new obj
      if (!oTCodePerUserData[key]) {
        oTCodePerUserData[key] = {
          TCode: oContext.TCode,
          TCodeName: oContext.TCodeName,
          TCodeCount: 0,
        };
      }

      oTCodePerUserData[key].TCodeCount += oContext.TCodeCount;
    });

    //  Convert into array
    let aTCodePerUserData = Object.values(oTCodePerUserData);

    // Sort data
    aTCodePerUserData.sort((a: any, b: any) => b.TCodeCount - a.TCodeCount);

    //  Top 5
    aTCodePerUserData = aTCodePerUserData.slice(0, 5);

    //  Add label
    aTCodePerUserData.forEach((item: any) => {
      item.Label = `${item.TCode} - ${item.TCodeName}`;
    });

    // Set data into Model ActivityTCodeByUser
    const oJsonModelActTcode = new JSONModel(aTCodePerUserData);
    this.getView()?.setModel(oJsonModelActTcode, "TCodeByUserData");

    // Create a list binding to /UserActivityLog with $filter
    const oUserActTable = oModel.bindList(
      "/UserActivityLog",
      undefined,
      undefined,
      [
        new Filter("Username", FilterOperator.EQ, sUsername),
        new Filter({
          path: "ActivityDate",
          operator: FilterOperator.BT,
          value1: from,
          value2: to,
        }),
      ],
    ) as ODataListBinding;

    const aDataTable = await this.fetchAllData(oUserActTable);

    const oTableModel = new JSONModel(aDataTable);
    this.getView()?.setModel(oTableModel, "UserActivityLogData");

    // Create a list binding to /UserActivittyPerDay with $filter
    const oUserActPerDate = oModel.bindList(
      "/UserActivittyPerDay",
      undefined,
      undefined,
      [
        new Filter("Username", FilterOperator.EQ, sUsername),
        new Filter({
          path: "ActivityDate",
          operator: FilterOperator.BT,
          value1: from,
          value2: to,
        }),
      ],
    ) as ODataListBinding;

    const aDataActPerDate = await this.fetchAllData(oUserActPerDate);

    const oActPerDayModel = new JSONModel(aDataActPerDate);
    this.getView()?.setModel(oActPerDayModel, "ActPerDateData");
  }

  /**
   * Fetch all data from OData using paging (skip + top)
   */
  private async fetchAllData(oBinding: ODataListBinding): Promise<any[]> {
    const aAllContexts: any[] = [];
    let iSkip = 0;
    const iPageSize = 100;

    while (true) {
      const aContexts = await oBinding.requestContexts(iSkip, iPageSize);

      if (aContexts.length === 0) break;

      aAllContexts.push(...aContexts);

      if (aContexts.length < iPageSize) break;

      iSkip += iPageSize;
    }

    return aAllContexts.map((oContext) => oContext.getObject());
  }

  /**
   * Navigate to AuthDetail page
   **/
  public onNavigationToAuthDetail(oEvent: any): void {
    // Get control and BindingContext of line
    const oItem = oEvent.getSource();
    const oContext = oItem.getBindingContext("UserAuthLogData");

    if (oContext) {
      const sSessionId = oContext.getProperty("SessionId");

      // Navigate with parameter session_id
      const oRouter = (this as any).getAppComponent().getRouter();
      if (oRouter) {
        oRouter.navTo("AuthDetail", {
          key: sSessionId,
        });
      }
    }
  }

  /**
   * Called when the user use filter auth status
   **/
  public onFilterAuth(): void {
    this.applyFilters();
  }

  /**
   * Called when the user use filter auth date
   **/
  public onFilterAuthLoginDate(): void {
    this.applyFilters();
  }

  /**
   * Execute logic search and filter
   **/
  public applyFilters(): void {
    const aFilters: Filter[] = [];

    const oTable = this.byId("AuthTableId") as Table;
    const oBinding = oTable.getBinding("rows") as ODataListBinding;

    // Get value from search and select
    const sStatus = (
      this.byId("AuthStatusSelectId") as Select
    ).getSelectedKey();

    if (sStatus) {
      aFilters.push(new Filter("LoginResult", FilterOperator.EQ, sStatus));
    }

    // Get value select date picker
    const oDatePicker = this.byId("AuthDatePickerId") as DatePicker;
    if (oDatePicker) {
      const oDate = oDatePicker.getDateValue();

      if (oDate) {
        const oFormatter = DateFormat.getDateInstance({
          pattern: "yyyy-MM-dd",
        });

        const sDate = oFormatter.format(oDate);

        aFilters.push(new Filter("LoginDate", FilterOperator.EQ, sDate));
      }
    }

    // Final filter and render into table
    const aFinalFilters = oDatePicker
      ? aFilters
      : [...this.getGlobalDateFilter(), ...aFilters];

    if (oBinding) {
      oBinding.filter(aFinalFilters);
    }
  }

  /**
   * Called when the user use filter activity
   **/
  public onFilterActivity(): void {
    this.applyActivityFilters();
  }

  /**
   * Called when the user use filter TCode
   **/
  public onSearchTCode(): void {
    this.applyActivityFilters();
  }

  /**
   * Execute logic filter activity
   **/
  public applyActivityFilters(): void {
    const aFilters: Filter[] = [];
    const { from, to } = this.getGlobalDateRange();

    const oTable = this.byId("ActivityTableId") as Table;
    const oBinding = oTable.getBinding("rows") as ODataListBinding;

    // Get value from search and select
    const sSearch = (this.byId("ActivityTCodeInputId") as Input).getValue();
    if (sSearch) {
      aFilters.push(new Filter("TCode", FilterOperator.Contains, sSearch));
    }

    // Get value from search and select
    const sStatus = (
      this.byId("ActivityTypeSelectId") as Select
    ).getSelectedKey();

    if (sStatus) {
      aFilters.push(new Filter("ActivityType", FilterOperator.EQ, sStatus));
    }

    // Get value select date picker
    const oDatePicker = this.byId("ActivityDatePickerId") as DatePicker;
    if (oDatePicker) {
      const oDate = oDatePicker.getDateValue();

      if (oDate) {
        const oFormatter = DateFormat.getDateInstance({
          pattern: "yyyy-MM-dd",
        });

        const sDate = oFormatter.format(oDate);

        aFilters.push(new Filter("ActivityDate", FilterOperator.EQ, sDate));
      }

      // Final filter and render into table
      const aFinalFilters = oDatePicker
        ? aFilters
        : [
            new Filter({
              path: "ActivityDate",
              operator: FilterOperator.BT,
              value1: from,
              value2: to,
            }),
            ...aFilters,
          ];

      if (oBinding) {
        oBinding.filter(aFinalFilters);
      }
    }
  }

  /**
   * Called when the value help of the user search input is triggered.
   * Fetches data from the OData service
   **/
  public async onUserSearchHelpTCode(): Promise<void> {
    try {
      const { from, to } = this.getGlobalDateRange();

      const oTCodeSearchHelpData = {} as any;

      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Create a list binding to /UserSearchHelp
      const oBinding = oModel.bindList(
        "/UserSearchHelpTCode",
        undefined,
        undefined,
        [
          new Filter({
            path: "ActivityDate",
            operator: FilterOperator.BT,
            value1: from,
            value2: to,
          }),
          new Filter("Username", FilterOperator.EQ, this._sUsername),
        ],
      ) as ODataListBinding;

      // Executes the OData call and load data
      const aContexts = await oBinding.requestContexts();

      aContexts.forEach((oContext) => {
        const oObj = oContext.getObject();
        const key = oObj.TCode;

        if (!oTCodeSearchHelpData[key]) {
          oTCodeSearchHelpData[key] = {
            TCode: oObj.TCode,
          };
        }
      });

      //  Convert into array
      let aTCodeSearchHelpData = Object.values(oTCodeSearchHelpData);

      const oJsonModel = new JSONModel(aTCodeSearchHelpData);

      this.getView()?.setModel(oJsonModel, "TCodeSeachHelp");

      if (!this._oTCodeSearchHelpDialog) {
        // Load fragment
        this._oTCodeSearchHelpDialog = (await Fragment.load({
          name: "useraudit.fragment.TCodeSearchHelp",
          controller: this,
        })) as Dialog;

        this.getView()?.addDependent(this._oTCodeSearchHelpDialog);
      }

      this._oTCodeSearchHelpDialog.open();
    } catch (error) {
      MessageBox.error("Failed to load TCode search help.");
    }
  }

  /**
   * Select TCode SearchHelp
   **/
  public onTCodeSelect(oEvent: any): void {
    const oItem = oEvent.getParameter("listItem");

    const oContext = oItem.getBindingContext("TCodeSeachHelp");
    const oSelected = oContext?.getObject();

    if (oSelected) {
      (this.byId("ActivityTCodeInputId") as Input).setValue(oSelected.TCode);
    }

    this.applyActivityFilters();

    this._oTCodeSearchHelpDialog?.close();
  }

  /**
   * Close Fragment TCode Search Help
   **/
  public onCloseTCodeDialog(): void {
    this._oTCodeSearchHelpDialog?.close();
  }

  /**
   * AUTHENTICATION
   * Exports the currently bound table data to an Excel file.
   * Uses sap.ui.export.Spreadsheet to generate the file
   * based on the current OData V4 list binding.
   */
  public onExportAuthExcel(): void {
    const { from, to } = this.getGlobalDateRange();

    const sFileName = `UserAuthenticationLogs_of_${this._sUsername}_${from}_to_${to}.xlsx`;

    MessageBox.confirm("Do you want to export this data to Excel?", {
      title: "Confirm Export",
      actions: ["YES", "NO"],
      emphasizedAction: "YES",

      onClose: (oAction: string | null) => {
        if (oAction === "YES") {
          // Get table and its OData list binding
          const oTable = this.byId("AuthTableId");
          const oBinding = oTable?.getBinding("rows") as ODataListBinding;

          // Format in Excel
          const aCols = [
            {
              label: "User Session",
              property: "SessionId",
              width: 25,
            },
            {
              label: "User Name",
              property: "Username",
              width: 15,
            },
            {
              label: "Login Result",
              property: "LoginResult",
              width: 10,
            },
            {
              label: "Login Date",
              property: "LoginDate",
              width: 15,
            },
            {
              label: "Login Time",
              property: "LoginTime",
              width: 15,
            },
            {
              label: "Login Message",
              property: "LoginMessage",
              width: 150,
            },
            {
              label: "Logout Date",
              property: "LogoutDate",
              width: 15,
            },
            {
              label: "Logout Time",
              property: "LogoutTime",
              width: 15,
            },
            {
              label: "Event ID",
              property: "EventId",
              width: 10,
            },
          ];

          // Spreadsheet config
          const oSettings = {
            workbook: { columns: aCols },
            dataSource: oBinding,
            fileName: sFileName,
            worker: false,
          };

          // Spreadsheet config
          const oSheet = new Spreadsheet(oSettings);
          // Create Excel file and download it
          oSheet
            .build()
            .then(() => {
              MessageToast.show("Export successful!", { duration: 3000 });
            })
            .catch(() => {
              MessageBox.error("Export failed.");
            })
            .finally(() => {
              oSheet.destroy();
            });
        }
      },
    });
  }

  /**
   * Open Fragment Settings Columns
   **/
  public async onOpenAuthSettings(): Promise<void> {
    if (!this._oAuthViewSettingsDialog) {
      // Load fragment
      this._oAuthViewSettingsDialog = (await Fragment.load({
        id: this.getView()?.getId(), //Fix duplicate id in fragment
        name: "useraudit.fragment.ViewSettingsDialog",
        controller: this,
      })) as Dialog;

      // Add Fragment into view
      this.getView()?.addDependent(this._oAuthViewSettingsDialog);

      this.initializeAuthColumnModel();
    }

    // Open
    this._oAuthViewSettingsDialog.open();
  }

  /**
   * Read auth columns list of table -> JSONModel
   * Bring it into Dialog View
   **/
  public initializeAuthColumnModel(): void {
    // Get table and its colums
    const oTable = this.byId("AuthTableId") as any;
    const aColumns = oTable.getColumns();

    // Remove Navigator column
    const aFilteredColumns = aColumns.filter(
      (oColumn: any) => !oColumn.getId().includes("AuthNavigateColumnId"),
    );

    // Create new array contain every column object
    const aColumnData = aFilteredColumns.map((oColumn: any) => {
      const oLabel = oColumn.getLabel();

      return {
        id: oColumn.getId(),
        label: oLabel ? oLabel.getText() : oColumn.getId(),
        visible: oColumn.getVisible(),
      };
    });

    // Create JSONModel, property columns
    const oModel = new JSONModel({
      columns: aColumnData,
    });

    this.getView()?.setModel(oModel, "columnsModel");
  }

  /**
   * Open Fragment Settings Columns
   **/
  public onConfirmViewSettings(): void {
    // Get table and its colums
    const oTable = this.byId("AuthTableId") as any;
    const aColumns = oTable.getColumns();

    // Get model and property
    const oModel = this.getView()?.getModel("columnsModel") as JSONModel;
    const aData = oModel.getProperty("/columns");

    // Set visible for column
    aColumns.forEach((oColumn: any) => {
      const oMatch = aData.find((column: any) => column.id === oColumn.getId());

      if (oMatch) {
        oColumn.setVisible(oMatch.visible);
      }
    });

    this._oAuthViewSettingsDialog?.close();
  }

  /**
   * Close Fragment Auth Settings Columns
   **/
  public onCancelViewSettings(): void {
    this._oAuthViewSettingsDialog?.close();
  }

  /**
   * ACTIVITY
   * Exports the currently bound table data to an Excel file.
   * Uses sap.ui.export.Spreadsheet to generate the file
   * based on the current OData V4 list binding.
   */
  public onExportActivityExcel(): void {
    const { from, to } = this.getGlobalDateRange();

    const sFileName = `UserActivityLogs_of_${this._sUsername}_${from}_to_${to}.xlsx`;

    MessageBox.confirm("Do you want to export this data to Excel?", {
      title: "Confirm Export",
      actions: ["YES", "NO"],
      emphasizedAction: "YES",

      onClose: (oAction: string | null) => {
        if (oAction === "YES") {
          // Get table and its OData list binding
          const oTable = this.byId("ActivityTableId");
          const oBinding = oTable?.getBinding("rows") as ODataListBinding;

          // Format in Excel
          const aCols = [
            { label: "Log Id", property: "LogId", width: 25 },
            { label: "TCode", property: "TCode", width: 15 },
            { label: "TCode Name", property: "TCodeName", width: 10 },
            {
              label: "Activity Message",
              property: "ActivityMessage",
              width: 15,
            },
            { label: "Activity Time", property: "ActivityTime", width: 15 },
            { label: "Activity Date", property: "ActivityDate", width: 150 },
          ];

          // Spreadsheet config
          const oSettings = {
            workbook: { columns: aCols },
            dataSource: oBinding,
            fileName: sFileName,
            worker: false,
          };

          // Spreadsheet config
          const oSheet = new Spreadsheet(oSettings);
          // Create Excel file and download it
          oSheet
            .build()
            .then(() => {
              MessageToast.show("Export successful!", { duration: 3000 });
            })
            .catch(() => {
              MessageBox.error("Export failed.");
            })
            .finally(() => {
              oSheet.destroy();
            });
        }
      },
    });
  }

  /**
   * Open Act Fragment Settings Columns
   **/
  public async onOpenActivitySettings(): Promise<void> {
    if (!this._oActViewSettingsDialog) {
      // Load fragment
      this._oActViewSettingsDialog = (await Fragment.load({
        name: "useraudit.fragment.ActivityViewSettingsDialog",
        controller: this,
      })) as Dialog;

      // Add Fragment into view
      this.getView()?.addDependent(this._oActViewSettingsDialog);

      this.initializeActivityColumnModel();
    }

    // Open
    this._oActViewSettingsDialog.open();
  }

  /**
   * Activity
   * Read columns list of table -> JSONModel
   * Bring it into Dialog View
   **/
  public initializeActivityColumnModel(): void {
    // Get table and its colums
    const oTable = this.byId("ActivityTableId") as any;
    const aColumns = oTable.getColumns();

    // Create new array contain every column object
    const aColumnData = aColumns.map((oColumn: any) => {
      const oLabel = oColumn.getLabel();

      return {
        id: oColumn.getId(),
        label: oLabel ? oLabel.getText() : oColumn.getId(),
        visible: oColumn.getVisible(),
      };
    });

    // Create JSONModel, property columns
    const oModel = new JSONModel({
      columns: aColumnData,
    });

    this.getView()?.setModel(oModel, "ActivityColumnsModel");
  }

  /**
   * Open Activity Fragment Settings Columns
   **/
  public onActConfirmViewSettings(): void {
    // Get table and its colums
    const oTable = this.byId("ActivityTableId") as any;
    const aColumns = oTable.getColumns();

    // Get model and property
    const oModel = this.getView()?.getModel(
      "ActivityColumnsModel",
    ) as JSONModel;
    const aData = oModel.getProperty("/columns");

    // Set visible for column
    aColumns.forEach((oColumn: any) => {
      const oMatch = aData.find((column: any) => column.id === oColumn.getId());

      if (oMatch) {
        oColumn.setVisible(oMatch.visible);
      }
    });

    this._oActViewSettingsDialog?.close();
  }

  /**
   * Close Activity Fragment Settings Columns
   **/
  public onActCancelViewSettings(): void {
    this._oActViewSettingsDialog?.close();
  }
  //  Exports Excel file
  public onExportUserDetailExcel(): void {
    const sFileName = `User_${this._sFromDate}_to_${this._sToDate}.xlsx`;

    MessageBox.confirm("Do you want to export this data to Excel?", {
      title: "Confirm Export",
      actions: ["YES", "NO"],
      emphasizedAction: "YES",

      onClose: (oAction: string | null) => {
        if (oAction === "YES") {
          const oModel = this.getView()?.getModel(
            "UserAuthLogData",
          ) as JSONModel;
          const aData = oModel?.getData();

          if (!aData || aData.length === 0) {
            MessageBox.error("No data to export.");
            return;
          }

          const aCols = [
            { label: "User Session", property: "SessionId", width: 25 },
            { label: "User Name", property: "Username", width: 15 },
            { label: "Login Result", property: "LoginResult", width: 10 },
            { label: "Login Date", property: "LoginDate", width: 15 },
            { label: "Login Time", property: "LoginTime", width: 15 },
            { label: "Login Message", property: "LoginMessage", width: 150 },
            { label: "Logout Date", property: "LogoutDate", width: 15 },
            { label: "Logout Time", property: "LogoutTime", width: 15 },
            { label: "Event ID", property: "EventId", width: 10 },
          ];

          const oSettings = {
            workbook: { columns: aCols },
            dataSource: aData,
            fileName: sFileName,
            worker: false,
          };

          const oSheet = new Spreadsheet(oSettings);

          oSheet
            .build()
            .then(() => {
              MessageToast.show("Export successful!", { duration: 3000 });
            })
            .catch(() => {
              MessageBox.error("Export failed.");
            })
            .finally(() => {
              oSheet.destroy();
            });
        }
      },
    });
  }
}
