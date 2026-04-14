import Controller from "sap/fe/core/PageController";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";
import Input from "sap/m/Input";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Select from "sap/m/Select";
import Dialog from "sap/m/Dialog";
import Formatter from "useraudit/formatter/Formatter";
import MessageBox from "sap/m/MessageBox";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import MessageToast from "sap/m/MessageToast";
import Fragment from "sap/ui/core/Fragment";
import DateFormat from "sap/ui/core/format/DateFormat";
import DatePicker from "sap/m/DatePicker";
import Table from "sap/ui/table/Table";
import Sorter from "sap/ui/model/Sorter";

export default class Main extends Controller {
  public formatter = Formatter;

  private _timer: any;

  // Default variable
  private _oViewSettingsDialog: Dialog | null = null;
  private _oUserSearchHelpDialog: Dialog | null = null;

  private _aUserFilters: Filter[] = [];
  private _aUserDateFilters: Filter[] = [];

  /**
   * Called when the controller is initialized.
   **/
  public onInit(): void {
    super.onInit();

    // Set busy ON
    this.getView()?.setBusy(true);

    try {
      // Create view model
      const oOverviewModel = new JSONModel({
        totalUsers: 0,
        totalLogs: 0,
        successLogin: 0,
        failedLogin: 0,
        lockedUsers: 0,
        dumpCount: 0,
        systemInformation: "",
      });
      this.getView()?.setModel(oOverviewModel, "Overview");

      const oGlobalModel = this.getAppComponent().getModel("global");
      if (oGlobalModel)
        oGlobalModel.attachPropertyChange(this.onGlobalDateChanged, this);

      this._rebindTable();

      this.onInitCount();
      this.onInitLogCount();
      this.onInitTcodeCount();
      this.onInitDumpCount();
      this.onInitOverviewData();
    } catch (error) {
      MessageBox.error("Failed to initialize data.");
    } finally {
      this.getView()?.setBusy(false);
    }
  }

  /**
   *Change date when user select global date range
   */
  public onGlobalDateChanged(oEvent: any): void {
    if (oEvent.getParameter("path") !== "/toDate") return;

    clearTimeout(this._timer);

    this._timer = setTimeout(async () => {
      const oView = this.getView();
      if (!oView) return;
      oView.setBusy(true);

      try {
        this._rebindTable();

        await Promise.all([
          this.onInitCount(),
          this.onInitLogCount(),
          this.onInitTcodeCount(),
          this.onInitDumpCount(),
          this.onInitOverviewData(),
        ]);

        // Reset Min Max Date after filter global
        const oDatePicker = this.byId("mainDatePickerId") as DatePicker;

        if (!oDatePicker) return;

        const { from, to } = this.getGlobalDateRange();

        oDatePicker.setMinDate(new Date(from));
        oDatePicker.setMaxDate(new Date(to));
      } finally {
        oView.setBusy(false);
      }
    }, 200);
  }

  /**
   * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
   * This hook is the same one that SAPUI5 controls get after being rendered.
   * @memberOf useraudit.controller.Main
   */
  public onAfterRendering(): void {
    // Set range in date picker
    const oDatePicker = this.byId("mainDatePickerId") as DatePicker;

    if (!oDatePicker) return;

    const { from, to } = this.getGlobalDateRange();

    oDatePicker.setMinDate(new Date(from));
    oDatePicker.setMaxDate(new Date(to));
  }

  /**
   * Apply custom filter request to avoid default request
   * When user user filter date, remove default filter
   * When user search, filter status alaway use default filter
   **/
  private _rebindTable(): void {
    const oTable = this.byId("maiTableId") as Table;

    // date filter: user or default
    const aDateFilters =
      this._aUserDateFilters.length > 0
        ? this._aUserDateFilters
        : this.getGlobalDateFilter();

    const aAllFilters = [...aDateFilters, ...this._aUserFilters];

    oTable.bindRows({
      path: "/UserAuthLog",
      filters: aAllFilters,
      parameters: { $count: true },
      sorter: [new Sorter("LoginDate", true)],
    });
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
   * Fetches the total number of records from the UserAuthLog entity
   **/
  public async onInitCount(): Promise<void> {
    try {
      // Create view model
      const oViewModel = new JSONModel({
        count: 0,
      });
      this.getView()?.setModel(oViewModel, "view");

      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Get model Overview
      const oOverviewModel = this.getView()?.getModel("Overview") as JSONModel;

      const aFilters = this.getGlobalDateFilter();

      // Create a list binding to /UserAuthLog with $count enabled
      const oBinding = oModel.bindList(
        "/UserAuthLog",
        undefined,
        undefined,
        aFilters,
        { $count: true },
      ) as ODataListBinding;

      // Executes the OData call
      await oBinding.requestContexts();

      const iCount = oBinding.getLength();

      // Create property of view model
      oViewModel.setProperty("/count", iCount);

      oOverviewModel.setProperty("/totalLogs", iCount);
    } catch (error) {
      MessageBox.error("Failed to load chart data.");
    }
  }

  /**
   * Fetches the data for Overview Data
   **/
  public async onInitOverviewData(): Promise<void> {
    try {
      const oUserSearchHelpData = {} as any;

      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Get model Overview
      const oOverviewModel = this.getView()?.getModel("Overview") as JSONModel;

      const aFilters = this.getGlobalDateFilter();

      // Create a list binding to /UserSearchHelp
      const oBindingTotalUser = oModel.bindList(
        "/UserSearchHelp",
        undefined,
        undefined,
        aFilters,
        {
          $count: true,
        },
      ) as ODataListBinding;

      // Executes the OData call and load ALL data (paging)
      const aAllContexts = [];
      let iSkip = 0;
      const iPageSize = 100;

      // Loop to fetch data page by page until all data is loaded
      while (true) {
        const aContexts = await oBindingTotalUser.requestContexts(
          iSkip,
          iPageSize,
        );

        // If no data is returned, stop the loop (no more data available)
        if (aContexts.length === 0) {
          break;
        }

        aAllContexts.push(...aContexts);

        // If returned data is less than page size,
        // it means this is the last page → stop the loop
        if (aContexts.length < iPageSize) {
          break;
        }

        iSkip += iPageSize;
      }

      aAllContexts.forEach((oContext) => {
        const oObj = oContext.getObject();
        const key = oObj.Username;

        if (!oUserSearchHelpData[key]) {
          oUserSearchHelpData[key] = {
            Username: oObj.Username,
          };
        }
      });

      //  Convert into array
      let aUserSearchHelpData = Object.values(oUserSearchHelpData);

      // Create property of view model
      oOverviewModel.setProperty("/totalUsers", aUserSearchHelpData?.length);

      const { from, to } = this.getGlobalDateRange();

      // Create a list binding to /UserActivityLog
      const oBindingTotalDump = oModel.bindList(
        "/UserActivityLog",
        undefined,
        undefined,
        [
          new Filter("ActivityType", FilterOperator.EQ, "DUMP"),
          new Filter({
            path: "ActivityDate",
            operator: FilterOperator.BT,
            value1: from,
            value2: to,
          }),
        ],
        {
          $count: true,
        },
      ) as ODataListBinding;

      // Executes the OData call
      await oBindingTotalDump.requestContexts();

      const iDumpCount = oBindingTotalDump.getLength();

      // Create property of view model
      oOverviewModel.setProperty("/dumpCount", iDumpCount);

      const oFilterUser = new Filter({
        filters: [
          new Filter("EventId", FilterOperator.EQ, "AUM"),
          ...this.getGlobalDateFilter(),
        ],
        and: true,
      });

      // Create a list binding to /UserAuthLog
      const oBindingTotalLockUser = oModel.bindList(
        "/UserAuthLog",
        undefined,
        undefined,
        [oFilterUser],
        {
          $count: true,
        },
      ) as ODataListBinding;

      // Executes the OData call
      await oBindingTotalLockUser.requestContexts(0, 1);

      const iTotalLockUsers = oBindingTotalLockUser.getLength();

      // Create property of view model
      oOverviewModel.setProperty("/lockedUsers", iTotalLockUsers);

      // Create a list binding to /SystemInformation
      const oBindingSystemInformation = oModel.bindList(
        "/SystemInformation",
      ) as ODataListBinding;

      // Executes the OData call
      const aSystemContexts = await oBindingSystemInformation.requestContexts();

      //  Add label
      const aDataSystem = aSystemContexts.map((oContext) => {
        const obj = oContext.getObject();
        return {
          ...obj,
          Label: `${obj.userCient} - ${obj.system_id}`,
        };
      });

      // Create property of view model
      oOverviewModel.setProperty("/systemInformation", aDataSystem[0].Label);
    } catch (error) {
      MessageBox.error("Failed to load overview data.");
    }
  }

  /**
   * Fetches the data of UserAuthLogChart entity
   **/
  public async onInitLogCount(): Promise<void> {
    try {
      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Get model Overview
      const oOverviewModel = this.getView()?.getModel("Overview") as JSONModel;

      const aFilters = this.getGlobalDateFilter();

      // Create a list binding to /UserAuthLogChart
      const oBinding = oModel.bindList(
        "/AuthLogChartByUser",
        undefined,
        undefined,
        aFilters,
        {
          $count: true,
        },
      ) as ODataListBinding;

      // ===== Fetch ALL data using paging =====
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

      const aData = aAllContexts.map((oContext) => oContext.getObject());

      // Set data for overview
      const objData = aData.reduce((acc, cur) => {
        acc[cur.LoginResult] = (acc[cur.LoginResult] || 0) + cur.CountLoginLog;

        return acc;
      }, {});

      // Set data for chart
      const arrayData = Object.keys(objData).map((key) => ({
        LoginResult: key,
        CountLoginLog: objData[key],
      }));
      const oJsonModel = new JSONModel(arrayData);

      // Set data for overview
      oOverviewModel.setProperty("/successLogin", objData.SUCCESS);
      oOverviewModel.setProperty("/failedLogin", objData.FAIL);

      // Set data into Model authLogChart
      this.getView()?.setModel(oJsonModel, "authLogChart");
    } catch (error) {
      MessageBox.error("Failed to load Login data.");
    }
  }

  /**
   * Fetches the data of ActivityLogChart entity
   **/
  public async onInitTcodeCount(): Promise<void> {
    try {
      const { from, to } = this.getGlobalDateRange();

      const oTCodeChartData = {} as any;

      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Create a list binding to /ActivityTCodeByUser
      const oBinding = oModel.bindList(
        "/ActivityTCodeByUser",
        undefined,
        undefined,
        new Filter("ActivityDate", FilterOperator.BT, from, to),
        {
          $orderby: "TCodeCount desc",
        },
      ) as ODataListBinding;

      // ===== Fetch ALL data using paging =====
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

      // Group by + SUM data
      aAllContexts.forEach((oContext) => {
        const oObj = oContext.getObject();

        const key = oObj.TCode;

        // If TCode is exist, plus TCodeCount, else create new obj
        if (!oTCodeChartData[key]) {
          oTCodeChartData[key] = {
            TCode: oObj.TCode,
            TCodeName: oObj.TCodeName,
            TCodeCount: 0,
          };
        }

        oTCodeChartData[key].TCodeCount += oObj.TCodeCount;
      });

      //  Convert into array
      let aTCodeChartData = Object.values(oTCodeChartData);

      // Sort data
      aTCodeChartData.sort((a: any, b: any) => b.TCodeCount - a.TCodeCount);

      //  Top 5
      aTCodeChartData = aTCodeChartData.slice(0, 5);

      //  Add label
      aTCodeChartData.forEach((item: any) => {
        item.Label = `${item.TCode} - ${item.TCodeName}`;
      });

      // Set data into Model tCodeChart
      const oJsonModel = new JSONModel(aTCodeChartData);
      this.getView()?.setModel(oJsonModel, "tCodeChart");
    } catch (error) {
      MessageBox.error("Failed to load TCode data.");
    }
  }

  /**
   * Fetches the data of DumpActivityChart entity
   **/
  public async onInitDumpCount(): Promise<void> {
    try {
      const { from, to } = this.getGlobalDateRange();

      const oDumpChartData = {} as any;

      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Create a list binding to /DumpActivityChart
      const oBinding = oModel.bindList(
        "/DumpActivityChart",
        undefined,
        undefined,
        new Filter("ActivityDate", FilterOperator.BT, from, to),
        {
          $orderby: "DumpCount desc",
        },
      ) as ODataListBinding;

      // ===== Fetch ALL data using paging =====
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

      aAllContexts.forEach((oContext) => {
        const oObj = oContext.getObject();
        const key = oObj.Username;

        if (!oDumpChartData[key]) {
          oDumpChartData[key] = {
            Username: oObj.Username,
            DumpCount: 0,
          };
        }

        oDumpChartData[key].DumpCount += oObj.DumpCount;
      });

      //  Convert into array
      let aDumpChartData = Object.values(oDumpChartData);

      // Sort data
      aDumpChartData.sort((a: any, b: any) => b.DumpCount - a.DumpCount);

      //  Top 10
      aDumpChartData = aDumpChartData.slice(0, 10);

      const oJsonModel = new JSONModel(aDumpChartData);

      // // Set data into Model dumpChart
      this.getView()?.setModel(oJsonModel, "dumpChart");
    } catch (error) {
      MessageBox.error("Failed to load Dump data.");
    }
  }

  /**
   * Called when the user use search
   **/
  public onSearchUserName(): void {
    this.applyFilters();
  }

  /**
   * Called when the user use filter status
   **/
  public onFilterStatus(): void {
    this.applyFilters();
  }

  /**
   * Called when the user use filter date
   **/
  public onFilterLoginDate(): void {
    this.applyFilters();
  }

  /**
   * Execute logic search and filter
   **/
  public applyFilters(): void {
    const oTable = this.byId("maiTableId") as Table;
    oTable.setBusy(true);

    try {
      const aFilters: Filter[] = [];
      this._aUserDateFilters = [];

      // Get value from search and select
      const sSearch = (this.byId("userSearchId") as Input).getValue();
      if (sSearch) {
        aFilters.push(new Filter("Username", FilterOperator.Contains, sSearch));
      }

      const sStatus = (
        this.byId("mainHeaderSelectId") as Select
      ).getSelectedKey();

      if (sStatus) {
        aFilters.push(new Filter("LoginResult", FilterOperator.EQ, sStatus));
      }

      // Get value select date picker
      const oDatePicker = this.byId("mainDatePickerId") as DatePicker;

      if (oDatePicker) {
        const oDate = oDatePicker.getDateValue();

        if (oDate) {
          const oFormatter = DateFormat.getDateInstance({
            pattern: "yyyy-MM-dd",
          });

          const sDate = oFormatter.format(oDate);

          this._aUserDateFilters = [
            new Filter("LoginDate", FilterOperator.EQ, sDate),
          ];
        }
      }

      this._aUserFilters = aFilters;
      this._rebindTable();

      // Turn off busy after load data
      const oBinding = oTable.getBinding("rows") as ODataListBinding;
      oBinding.requestContexts().finally(() => {
        oTable.setBusy(false);
      });
    } catch (error) {
      oTable.setBusy(false);
    }
  }

  /**
   * Exports the currently bound table data to an Excel file.
   * Uses sap.ui.export.Spreadsheet to generate the file
   * based on the current OData V4 list binding.
   */
  public onExportExcel(): void {
    const { from, to } = this.getGlobalDateRange();

    const sFileName = `UserAuthenticationLogs_${from}_to_${to}.xlsx`;

    MessageBox.confirm("Do you want to export this data to Excel?", {
      title: "Confirm Export",
      actions: ["YES", "NO"],
      emphasizedAction: "YES",

      onClose: (oAction: string | null) => {
        if (oAction === "YES") {
          // Get table and its OData list binding
          const oTable = this.byId("maiTableId");
          const oBinding = oTable?.getBinding("rows") as ODataListBinding;
          // Format in Excel
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
   * Called when the value help of the user search input is triggered.
   * Fetches data from the OData service
   **/
  public async onUserSearchHelp(): Promise<void> {
    try {
      const { from, to } = this.getGlobalDateRange();

      const oUserSearchHelpData = {} as any;

      // Get OData V4 model from the App Component
      const oModel = this.getAppComponent().getModel() as ODataModel;

      // Create a list binding to /UserSearchHelp
      const oBinding = oModel.bindList(
        "/UserSearchHelp",
        undefined,
        undefined,
        new Filter({
          path: "LoginDate",
          operator: FilterOperator.BT,
          value1: from,
          value2: to,
        }),
      ) as ODataListBinding;

      // Executes the OData call and load ALL data (paging)
      const aAllContexts = [];
      let iSkip = 0;
      const iPageSize = 100;

      // Loop to fetch data page by page until all data is loaded
      while (true) {
        const aContexts = await oBinding.requestContexts(iSkip, iPageSize);

        // If no data is returned, stop the loop (no more data available)
        if (aContexts.length === 0) {
          break;
        }

        aAllContexts.push(...aContexts);

        // If returned data is less than page size,
        // it means this is the last page → stop the loop
        if (aContexts.length < iPageSize) {
          break;
        }

        iSkip += iPageSize;
      }

      aAllContexts.forEach((oContext) => {
        const oObj = oContext.getObject();
        const key = oObj.Username;

        if (!oUserSearchHelpData[key]) {
          oUserSearchHelpData[key] = {
            Username: oObj.Username,
          };
        }
      });

      //  Convert into array
      let aUserSearchHelpData = Object.values(oUserSearchHelpData);

      const oJsonModel = new JSONModel(aUserSearchHelpData);

      this.getView()?.setModel(oJsonModel, "userSeachHelp");

      if (!this._oUserSearchHelpDialog) {
        // Load fragment
        this._oUserSearchHelpDialog = (await Fragment.load({
          name: "useraudit.fragment.UserSearchHelp",
          controller: this,
        })) as Dialog;

        this.getView()?.addDependent(this._oUserSearchHelpDialog);
      }

      this._oUserSearchHelpDialog.open();
    } catch (error) {
      MessageBox.error("Failed to load user search help.");
    }
  }

  /**
   * Select User SearchHelp
   **/
  public onUserSelect(oEvent: any): void {
    const oItem = oEvent.getParameter("listItem");

    const oContext = oItem.getBindingContext("userSeachHelp");
    const oSelected = oContext?.getObject();

    if (oSelected) {
      (this.byId("userSearchId") as Input).setValue(oSelected.Username);
    }

    this.applyFilters();

    this._oUserSearchHelpDialog?.close();
  }

  /**
   * Close Fragment User Search Help
   **/
  public onCloseUserDialog(): void {
    this._oUserSearchHelpDialog?.close();
  }

  /**
   * Navigate to AuthDetail page
   **/
  public onPressNavigate(oEvent: any): void {
    // Get control and BindingContext of line
    const oItem = oEvent.getSource();
    const oContext = oItem.getBindingContext();

    if (oContext) {
      // Get path
      let sPath = oContext.getPath();

      if (sPath.startsWith("/")) {
        sPath = sPath.substring(1);
      }

      // Navigate with parameter session_id
      const oRouter = (this as any).getAppComponent().getRouter();
      if (oRouter) {
        oRouter.navTo("AuthDetail", {
          key: sPath,
        });
      }
    }
  }

  /**
   * Open Fragment Settings Columns
   **/
  public async onOpenViewSettings(): Promise<void> {
    if (!this._oViewSettingsDialog) {
      // Load fragment
      this._oViewSettingsDialog = (await Fragment.load({
        name: "useraudit.fragment.ViewSettingsDialog",
        controller: this,
      })) as Dialog;

      // Add Fragment into view
      this.getView()?.addDependent(this._oViewSettingsDialog);

      this.initializeColumnModel();
    }

    // Open
    this._oViewSettingsDialog.open();
  }

  /**
   * Read columns list of table -> JSONModel
   * Bring it into Dialog View
   **/
  public initializeColumnModel(): void {
    // Get table and its colums
    const oTable = this.byId("maiTableId") as any;
    const aColumns = oTable.getColumns();

    // Remove Navigator column
    const aFilteredColumns = aColumns.filter(
      (oColumn: any) => !oColumn.getId().includes("columnNavigator"),
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
    const oTable = this.byId("maiTableId") as any;
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

    this._oViewSettingsDialog?.close();
  }

  /**
   * Close Fragment Settings Columns
   **/
  public onCancelViewSettings(): void {
    this._oViewSettingsDialog?.close();
  }

  /**
   * Refresh data of table
   **/
  public async onRefreshTable(): Promise<void> {
    const oTable = this.byId("maiTableId") as any;
    const oBinding = oTable.getBinding("rows") as ODataListBinding;

    oTable.setBusy(true);

    try {
      // Refresh data
      await oBinding?.requestRefresh();

      // Refresh dashboard data
      await this.onInitCount();
      await this.onInitLogCount();
      await this.onInitTcodeCount();

      MessageToast.show("Data refreshed");
    } finally {
      oTable.setBusy(false);
    }
  }

  /**
   * Navigate to user detail page
   **/
  public onNavigateUserDetail(oEvent: any): void {
    // Get control and BindingContext of line
    const oItem = oEvent.getSource();
    const oContext = oItem.getBindingContext();

    if (oContext) {
      const sUsername = oContext.getProperty("Username");

      // Navigate with parameter username
      const oRouter = (this as any).getAppComponent().getRouter();
      if (oRouter) {
        oRouter.navTo("UserDetail", {
          username: sUsername,
        });
      }
    }
  }

  /**
   * Validate in global filter daterange
   * Not allow to filter more than 6 days
   **/
  public onGlobalDateRangeChange(oEvent: any): void {
    const oSource = oEvent.getSource();

    const oFrom = oSource.getDateValue();
    const oTo = oSource.getSecondDateValue();

    if (!oFrom || !oTo) return;

    // Calculate date
    const iDiffTime = oTo.getTime() - oFrom.getTime();
    const iDiffDays = iDiffTime / (1000 * 60 * 60 * 24);

    if (iDiffDays > 30) {
      MessageToast.show("Max range is 30 days");

      const oToday = new Date();

      const oFromNew = new Date(oToday);
      oFromNew.setDate(oToday.getDate() - 5);

      const oToNew = oToday;

      oSource.setDateValue(oFromNew);
      oSource.setSecondDateValue(oToNew);
    }
  }
}
