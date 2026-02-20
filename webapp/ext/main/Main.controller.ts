import Controller from "sap/fe/core/PageController";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";
import Input from "sap/m/Input";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Select from "sap/m/Select";
import List from "sap/m/List";
import StandardListItem from "sap/m/StandardListItem";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";

export default class Main extends Controller {
  /**
   * Called when the controller is initialized.
   **/
  public onInit(): void {
    super.onInit();

    this.onInitCount();
  }

  /**
   * Fetches the total number of records from the UserAuthLog entity
   **/
  public async onInitCount(): Promise<void> {
    // Create view model
    const oViewModel = new JSONModel({
      count: 0,
    });
    this.getView()?.setModel(oViewModel, "view");

    // Get OData V4 model from the App Component
    const oModel = this.getAppComponent().getModel() as ODataModel;

    // Create a list binding to /UserAuthLog with $count enabled
    const oBinding = oModel.bindList(
      "/UserAuthLog",
      undefined,
      undefined,
      undefined,
      { $count: true },
    ) as ODataListBinding;

    // Executes the OData call
    await oBinding.requestContexts(0, 1);

    const iCount = oBinding.getLength();

    // Create property of view model
    oViewModel.setProperty("/count", iCount);
  }

  /**
   * Called when the user use search
   **/
  public onSearchUserName(): void {
    this.applyFilters();
  }

  /**
   * Called when the user use filter
   **/
  public onFilterStatus(): void {
    this.applyFilters();
  }

  /**
   * Execute logic search and filter
   **/
  public applyFilters(): void {
    const aFilters: Filter[] = [];

    // Get table and its OData list binding
    const oTable = this.byId("maiTableId");
    const oBinding = oTable?.getBinding("items") as ODataListBinding;

    // Get value from search and select
    const sSearch = (this.byId("userSearchId") as Input).getValue();
    const sStatus = (
      this.byId("mainHeaderSelectId") as Select
    ).getSelectedKey();

    // Search and Filter
    if (sSearch) {
      aFilters.push(new Filter("Username", FilterOperator.Contains, sSearch));
    }
    if (sStatus) {
      aFilters.push(new Filter("LoginResult", FilterOperator.EQ, sStatus));
    }

    // Apply filters to binding (triggers OData request)
    oBinding.filter(aFilters);
  }

  /**
   * Called when the value help of the user search input is triggered.
   * Fetches data from the OData service
   **/
  public async onUserSearchHelp(): Promise<void> {
    // Get OData V4 model from the App Component
    const oModel = this.getAppComponent().getModel() as ODataModel;

    if (!oModel) {
      return;
    }

    // Create a list binding to /UserSearchHelp
    const oBinding = oModel.bindList("/UserSearchHelp") as ODataListBinding;

    // Executes the OData call and load data
    const aContexts = await oBinding.requestContexts(0, 1000);
    const aData = aContexts.map((oContext) => oContext.getObject());

    const oJsonModel = new JSONModel(aData);

    // Create List
    const oList = new List({
      mode: "SingleSelectMaster",
      items: {
        path: "/",
        template: new StandardListItem({
          title: "{Username}",
        }),
      },
      selectionChange: (oEvent) => {
        //Get line that user click
        const oItem = oEvent.getParameter("listItem");
        if (!oItem) {
          return;
        }

        // Connects the UI item to its underlying model data
        const oContext = oItem.getBindingContext();

        // Get the actual data object from the model
        const oSelected = oContext?.getObject();

        if (oSelected) {
          (this.byId("userSearchId") as Input).setValue(oSelected.Username);
        }

        // Filter
        this.applyFilters();

        oDialog.close();
      },
    });

    oList.setModel(oJsonModel);

    // Create Dialog
    const oDialog = new Dialog({
      title: "Select User",
      contentWidth: "400px",
      contentHeight: "500px",
      content: [oList],
      endButton: new Button({
        text: "Close",
        press: () => oDialog.close(),
      }),
    });

    oDialog.open();
  }

  /**
   * Called before the view is re-rendered.
   **/
  // public  onBeforeRendering(): void {
  //
  //  }
  /**
   * Called after the view has been rendered.
   **/
  // public  onAfterRendering(): void {
  //
  //  }
  /**
   * Called when the controller is destroyed.
   **/
  // public onExit(): void {
  //
  //  }
}
